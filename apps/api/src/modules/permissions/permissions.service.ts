import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { RoleEntity } from './entities/role.entity';
import { EntityPermission } from './entities/entity-permission.entity';
import { AbacPolicy } from './entities/abac-policy.entity';
import { RedisService } from '../redis/redis.service';

interface PermissionContext {
  user: {
    id: string;
    tenantId: string;
    roles: string[];
    email?: string;
    createdAt?: Date;
  };
  resource?: {
    createdBy?: string;
    bookId?: string;
    chapterId?: string;
    isDraft?: boolean;
  };
  environment?: {
    ip?: string;
    time?: Date;
  };
}

interface PermissionResult {
  allowed: boolean;
  reason: string;
  matchedPolicy?: string;
}

const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'perm:';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(EntityPermission)
    private readonly permRepo: Repository<EntityPermission>,
    @InjectRepository(AbacPolicy)
    private readonly abacRepo: Repository<AbacPolicy>,
    private readonly redis: RedisService,
  ) {}

  async createDefaultRoles(tenantId: string): Promise<RoleEntity[]> {
    const roleDefinitions = [
      { name: 'admin', description: 'Full system access', permissions: ['*'], isSystem: true },
      { name: 'editor', description: 'Create and edit content', permissions: ['view', 'edit', 'create'], isSystem: true },
      { name: 'viewer', description: 'Read-only access', permissions: ['view'], isSystem: true },
    ];
    const roles = roleDefinitions.map((def) =>
      this.roleRepo.create({ ...def, tenantId }),
    );
    return this.roleRepo.save(roles);
  }

  async findRoleByName(tenantId: string, name: string): Promise<RoleEntity | null> {
    return this.roleRepo.findOne({ where: { tenantId, name } });
  }

  async findRolesForUser(userId: string, tenantId: string): Promise<RoleEntity[]> {
    return this.roleRepo
      .createQueryBuilder('r')
      .innerJoin('user_roles', 'ur', 'ur."rolesId" = r.id')
      .where('ur."usersId" = :userId', { userId })
      .andWhere('r."tenantId" = :tenantId', { tenantId })
      .getMany();
  }

  async hasPermission(
    userId: string,
    tenantId: string,
    entityType: string,
    entityId: string,
    requiredActions: string[],
    parentEntities?: { type: string; id: string }[],
    context?: Partial<PermissionContext>,
  ): Promise<boolean> {
    const cacheKey = `${CACHE_PREFIX}${tenantId}:${userId}:${entityType}:${entityId}:${requiredActions.sort().join(',')}`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      return cached === '1';
    }

    const result = await this.evaluatePermission(userId, tenantId, entityType, entityId, requiredActions, parentEntities, context);

    await this.redis.set(cacheKey, result ? '1' : '0', CACHE_TTL);
    return result;
  }

  private async evaluatePermission(
    userId: string,
    tenantId: string,
    entityType: string,
    entityId: string,
    requiredActions: string[],
    parentEntities?: { type: string; id: string }[],
    context?: Partial<PermissionContext>,
  ): Promise<boolean> {
    const userRoles = await this.findRolesForUser(userId, tenantId);
    const roleIds = userRoles.map((r) => r.id);
    const roleNames = userRoles.map((r) => r.name);

    // Step 1: Check explicit DENY rules (highest priority)
    const denied = await this.checkExplicitDeny(tenantId, entityType, entityId, requiredActions, userId, roleIds);
    if (denied) return false;

    // Step 2: Check ABAC policies
    const abacResult = await this.evaluateAbacPolicies(tenantId, entityType, requiredActions, {
      user: { id: userId, tenantId, roles: roleNames, ...context?.user },
      resource: context?.resource,
      environment: context?.environment || { time: new Date() },
    });
    if (abacResult !== null) return abacResult;

    // Step 3: Check direct entity permission (allow)
    if (await this.checkEntityPermission(tenantId, entityType, entityId, requiredActions, userId, roleIds, 'allow')) {
      return true;
    }

    // Step 4: Check inherited permissions from parent entities
    if (parentEntities && parentEntities.length > 0) {
      for (const parent of parentEntities) {
        const parentDenied = await this.checkExplicitDeny(tenantId, parent.type, parent.id, requiredActions, userId, roleIds);
        if (parentDenied) return false;

        if (await this.checkEntityPermission(tenantId, parent.type, parent.id, requiredActions, userId, roleIds, 'allow')) {
          return true;
        }
      }
    }

    // Step 5: Fall back to role-based defaults
    return this.checkRoleDefault(roleNames, requiredActions);
  }

  private async checkExplicitDeny(
    tenantId: string,
    entityType: string,
    entityId: string,
    actions: string[],
    userId: string,
    userRoleIds: string[],
  ): Promise<boolean> {
    return this.checkEntityPermission(tenantId, entityType, entityId, actions, userId, userRoleIds, 'deny');
  }

  private async checkEntityPermission(
    tenantId: string,
    entityType: string,
    entityId: string,
    actions: string[],
    userId: string,
    userRoleIds: string[],
    effect: string,
  ): Promise<boolean> {
    const qb = this.permRepo
      .createQueryBuilder('ep')
      .where('ep."tenantId" = :tenantId', { tenantId })
      .andWhere('ep."entityType" = :entityType', { entityType })
      .andWhere('ep."entityId" = :entityId', { entityId })
      .andWhere('ep.action IN (:...actions)', { actions })
      .andWhere('ep.effect = :effect', { effect });

    if (userRoleIds.length > 0) {
      qb.andWhere(
        '(ep."userId" = :userId OR ep."roleId" IN (:...userRoleIds))',
        { userId, userRoleIds },
      );
    } else {
      qb.andWhere('ep."userId" = :userId', { userId });
    }

    const found = await qb.getOne();
    return !!found;
  }

  private async evaluateAbacPolicies(
    tenantId: string,
    entityType: string,
    actions: string[],
    context: PermissionContext,
  ): Promise<boolean | null> {
    const policies = await this.abacRepo.find({
      where: { tenantId, entityType, enabled: true },
      order: { priority: 'DESC' },
    });

    const matchingPolicies = policies.filter((policy) =>
      actions.includes(policy.action) && this.matchConditions(policy.conditions, context),
    );

    if (matchingPolicies.length === 0) return null;

    // Higher priority wins; deny takes precedence at same priority
    const sorted = matchingPolicies.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.effect === 'deny' ? -1 : 1;
    });

    return sorted[0].effect === 'allow';
  }

  private matchConditions(conditions: Record<string, any>, context: PermissionContext): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      const actual = this.resolveContextValue(key, context);
      if (!this.evaluateCondition(actual, value)) return false;
    }
    return true;
  }

  private resolveContextValue(path: string, context: PermissionContext): any {
    const parts = path.split('.');
    let current: any = context;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }

  private evaluateCondition(actual: any, expected: any): boolean {
    if (expected === null || expected === undefined) return actual == null;
    if (typeof expected === 'object' && !Array.isArray(expected)) {
      // Operator-based conditions: { $eq, $ne, $in, $nin, $gt, $gte, $lt, $lte }
      for (const [op, val] of Object.entries(expected)) {
        switch (op) {
          case '$eq': if (actual !== val) return false; break;
          case '$ne': if (actual === val) return false; break;
          case '$in': if (!Array.isArray(val) || !val.includes(actual)) return false; break;
          case '$nin': if (Array.isArray(val) && val.includes(actual)) return false; break;
          case '$gt': if (!(actual > (val as any))) return false; break;
          case '$gte': if (!(actual >= (val as any))) return false; break;
          case '$lt': if (!(actual < (val as any))) return false; break;
          case '$lte': if (!(actual <= (val as any))) return false; break;
          case '$exists': if ((val && actual == null) || (!val && actual != null)) return false; break;
          default: return false;
        }
      }
      return true;
    }
    return actual === expected;
  }

  private checkRoleDefault(roleNames: string[], requiredActions: string[]): boolean {
    for (const action of requiredActions) {
      switch (action) {
        case 'view':
          if (roleNames.length > 0) return true;
          break;
        case 'edit':
        case 'create':
          if (roleNames.includes('admin') || roleNames.includes('editor')) return true;
          break;
        case 'delete':
          if (roleNames.includes('admin')) return true;
          break;
      }
    }
    return false;
  }

  async invalidatePermissionCache(tenantId: string, userId?: string): Promise<void> {
    if (userId) {
      await this.redis.delPattern(`${CACHE_PREFIX}${tenantId}:${userId}:*`);
    } else {
      await this.redis.delPattern(`${CACHE_PREFIX}${tenantId}:*`);
    }
    await this.redis.publish('permission:invalidate', JSON.stringify({ tenantId, userId }));
  }

  applyPermissionFilter<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    userId: string,
    tenantId: string,
    userRoles: string[],
    entityType: string,
    userRoleIds?: string[],
  ): SelectQueryBuilder<T> {
    if (userRoles.includes('admin')) {
      return qb;
    }

    if (userRoles.includes('editor') || userRoles.includes('viewer')) {
      // Check for explicit deny
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM entity_permissions ep_deny
          WHERE ep_deny."entityType" = :denyEntityType
          AND ep_deny."entityId" = ${alias}.id
          AND ep_deny."tenantId" = :denyTenantId
          AND ep_deny.effect = 'deny'
          AND ep_deny.action = 'view'
          AND (ep_deny."userId" = :denyUserId ${userRoleIds && userRoleIds.length > 0 ? 'OR ep_deny."roleId" IN (:...denyRoleIds)' : ''})
        )`,
        {
          denyEntityType: entityType,
          denyTenantId: tenantId,
          denyUserId: userId,
          ...(userRoleIds && userRoleIds.length > 0 ? { denyRoleIds: userRoleIds } : {}),
        },
      );
      return qb;
    }

    if (userRoleIds && userRoleIds.length > 0) {
      qb.andWhere(
        `(${alias}."createdBy" = :filterUserId OR EXISTS (
          SELECT 1 FROM entity_permissions ep
          WHERE ep."entityType" = :filterEntityType
          AND ep."entityId" = ${alias}.id
          AND ep."tenantId" = :filterTenantId
          AND ep.action IN ('view', 'edit')
          AND ep.effect = 'allow'
          AND (ep."userId" = :filterUserId OR ep."roleId" IN (:...filterRoleIds))
        ))`,
        {
          filterUserId: userId,
          filterEntityType: entityType,
          filterTenantId: tenantId,
          filterRoleIds: userRoleIds,
        },
      );
    } else {
      qb.andWhere(
        `(${alias}."createdBy" = :filterUserId OR EXISTS (
          SELECT 1 FROM entity_permissions ep
          WHERE ep."entityType" = :filterEntityType
          AND ep."entityId" = ${alias}.id
          AND ep."tenantId" = :filterTenantId
          AND ep.action IN ('view', 'edit')
          AND ep.effect = 'allow'
          AND ep."userId" = :filterUserId
        ))`,
        {
          filterUserId: userId,
          filterEntityType: entityType,
          filterTenantId: tenantId,
        },
      );
    }

    return qb;
  }

  async grantPermission(
    tenantId: string,
    entityType: string,
    entityId: string,
    action: string,
    userId?: string,
    roleId?: string,
    effect: string = 'allow',
    priority: number = 0,
  ): Promise<EntityPermission> {
    const perm = this.permRepo.create({
      tenantId,
      entityType,
      entityId,
      action,
      userId: userId || null,
      roleId: roleId || null,
      effect,
      priority,
    });
    const saved = await this.permRepo.save(perm);
    await this.invalidatePermissionCache(tenantId, userId);
    return saved;
  }

  async revokePermission(id: string, tenantId: string): Promise<void> {
    const perm = await this.permRepo.findOne({ where: { id, tenantId } });
    await this.permRepo.delete({ id, tenantId });
    if (perm?.userId) {
      await this.invalidatePermissionCache(tenantId, perm.userId);
    } else {
      await this.invalidatePermissionCache(tenantId);
    }
  }

  async getPermissionsForEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<EntityPermission[]> {
    return this.permRepo.find({
      where: { tenantId, entityType, entityId },
      order: { priority: 'DESC', effect: 'ASC' },
    });
  }

  // ABAC Policy management
  async createAbacPolicy(data: Partial<AbacPolicy>): Promise<AbacPolicy> {
    const policy = this.abacRepo.create(data);
    const saved = await this.abacRepo.save(policy);
    await this.invalidatePermissionCache(data.tenantId!);
    return saved;
  }

  async updateAbacPolicy(id: string, tenantId: string, data: Partial<AbacPolicy>): Promise<AbacPolicy> {
    await this.abacRepo.update({ id, tenantId }, data);
    const updated = await this.abacRepo.findOneOrFail({ where: { id, tenantId } });
    await this.invalidatePermissionCache(tenantId);
    return updated;
  }

  async deleteAbacPolicy(id: string, tenantId: string): Promise<void> {
    await this.abacRepo.delete({ id, tenantId });
    await this.invalidatePermissionCache(tenantId);
  }

  async listAbacPolicies(tenantId: string): Promise<AbacPolicy[]> {
    return this.abacRepo.find({
      where: { tenantId },
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  // Role management
  async listRoles(tenantId: string): Promise<RoleEntity[]> {
    return this.roleRepo.find({ where: { tenantId }, order: { name: 'ASC' } });
  }

  async createRole(data: Partial<RoleEntity>): Promise<RoleEntity> {
    const role = this.roleRepo.create(data);
    return this.roleRepo.save(role);
  }

  async updateRole(id: string, tenantId: string, data: Partial<RoleEntity>): Promise<RoleEntity> {
    await this.roleRepo.update({ id, tenantId }, data);
    const updated = await this.roleRepo.findOneOrFail({ where: { id, tenantId } });
    await this.invalidatePermissionCache(tenantId);
    return updated;
  }

  async deleteRole(id: string, tenantId: string): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { id, tenantId } });
    if (role?.isSystem) {
      throw new Error('Cannot delete system role');
    }
    await this.roleRepo.delete({ id, tenantId });
    await this.invalidatePermissionCache(tenantId);
  }
}
