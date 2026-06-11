import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { RoleEntity } from './entities/role.entity';
import { EntityPermission } from './entities/entity-permission.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(EntityPermission)
    private readonly permRepo: Repository<EntityPermission>,
  ) {}

  async createDefaultRoles(tenantId: string): Promise<RoleEntity[]> {
    const roles = ['admin', 'editor', 'viewer'].map((name) =>
      this.roleRepo.create({ name, tenantId }),
    );
    return this.roleRepo.save(roles);
  }

  async findRoleByName(
    tenantId: string,
    name: string,
  ): Promise<RoleEntity | null> {
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

  /**
   * Check if a user has permission on a specific entity.
   * Resolution order:
   * 1. Direct entity_permissions for this user or their role IDs
   * 2. Inherited entity_permissions from parent entities
   * 3. Role-based defaults (viewer=view, editor=view+edit, admin=all)
   */
  async hasPermission(
    userId: string,
    tenantId: string,
    entityType: string,
    entityId: string,
    requiredActions: string[],
    parentEntities?: { type: string; id: string }[],
  ): Promise<boolean> {
    const userRoles = await this.findRolesForUser(userId, tenantId);
    const roleIds = userRoles.map((r) => r.id);
    const roleNames = userRoles.map((r) => r.name);

    // Step 1: Check direct entity permission for user or user's roles
    if (await this.checkEntityPermission(tenantId, entityType, entityId, requiredActions, userId, roleIds)) {
      return true;
    }

    // Step 2: Check inherited permissions from parent entities
    if (parentEntities && parentEntities.length > 0) {
      for (const parent of parentEntities) {
        if (await this.checkEntityPermission(tenantId, parent.type, parent.id, requiredActions, userId, roleIds)) {
          return true;
        }
      }
    }

    // Step 3: Fall back to role-based defaults
    return this.checkRoleDefault(roleNames, requiredActions);
  }

  private async checkEntityPermission(
    tenantId: string,
    entityType: string,
    entityId: string,
    actions: string[],
    userId: string,
    userRoleIds: string[],
  ): Promise<boolean> {
    const qb = this.permRepo
      .createQueryBuilder('ep')
      .where('ep."tenantId" = :tenantId', { tenantId })
      .andWhere('ep."entityType" = :entityType', { entityType })
      .andWhere('ep."entityId" = :entityId', { entityId })
      .andWhere('ep.action IN (:...actions)', { actions });

    // Must match either the user directly OR one of the user's actual roles
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

  private checkRoleDefault(roleNames: string[], requiredActions: string[]): boolean {
    for (const action of requiredActions) {
      switch (action) {
        case 'view':
          // Any assigned role grants view by default
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

  /**
   * Apply permission-based filtering to a query builder for listing entities.
   * Only matches permissions granted to this specific user or their actual role IDs.
   */
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

    // Editors can view all by role default — no entity-level filter needed for read
    if (userRoles.includes('editor') || userRoles.includes('viewer')) {
      return qb;
    }

    // Users with no recognized role: only see own + explicitly permitted
    if (userRoleIds && userRoleIds.length > 0) {
      qb.andWhere(
        `(${alias}."createdBy" = :filterUserId OR EXISTS (` +
        `SELECT 1 FROM entity_permissions ep ` +
        `WHERE ep."entityType" = :filterEntityType ` +
        `AND ep."entityId" = ${alias}.id ` +
        `AND ep."tenantId" = :filterTenantId ` +
        `AND ep.action IN ('view', 'edit') ` +
        `AND (ep."userId" = :filterUserId OR ep."roleId" IN (:...filterRoleIds))` +
        `))`,
        {
          filterUserId: userId,
          filterEntityType: entityType,
          filterTenantId: tenantId,
          filterRoleIds: userRoleIds,
        },
      );
    } else {
      qb.andWhere(
        `(${alias}."createdBy" = :filterUserId OR EXISTS (` +
        `SELECT 1 FROM entity_permissions ep ` +
        `WHERE ep."entityType" = :filterEntityType ` +
        `AND ep."entityId" = ${alias}.id ` +
        `AND ep."tenantId" = :filterTenantId ` +
        `AND ep.action IN ('view', 'edit') ` +
        `AND ep."userId" = :filterUserId` +
        `))`,
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
  ): Promise<EntityPermission> {
    const perm = this.permRepo.create({
      tenantId,
      entityType,
      entityId,
      action,
      userId: userId || null,
      roleId: roleId || null,
    });
    return this.permRepo.save(perm);
  }

  async revokePermission(id: string, tenantId: string): Promise<void> {
    await this.permRepo.delete({ id, tenantId });
  }

  async getPermissionsForEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<EntityPermission[]> {
    return this.permRepo.find({
      where: { tenantId, entityType, entityId },
    });
  }
}
