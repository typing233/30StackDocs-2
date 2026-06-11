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
   * Supports hierarchical lookup: page -> chapter -> book.
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

    // Check direct user permission on this entity
    const directPerm = await this.permRepo
      .createQueryBuilder('ep')
      .where('ep.tenantId = :tenantId', { tenantId })
      .andWhere('ep.entityType = :entityType', { entityType })
      .andWhere('ep.entityId = :entityId', { entityId })
      .andWhere('ep.action IN (:...actions)', { actions: requiredActions })
      .andWhere(
        '(ep.userId = :userId' +
        (roleIds.length > 0 ? ' OR ep.roleId IN (:...roleIds)' : '') +
        ')',
        { userId, ...(roleIds.length > 0 ? { roleIds } : {}) },
      )
      .getOne();

    if (directPerm) return true;

    // Check inherited permissions from parent entities
    if (parentEntities && parentEntities.length > 0) {
      for (const parent of parentEntities) {
        const parentPerm = await this.permRepo
          .createQueryBuilder('ep')
          .where('ep.tenantId = :tenantId', { tenantId })
          .andWhere('ep.entityType = :pType', { pType: parent.type })
          .andWhere('ep.entityId = :pId', { pId: parent.id })
          .andWhere('ep.action IN (:...actions)', { actions: requiredActions })
          .andWhere(
            '(ep.userId = :userId' +
            (roleIds.length > 0 ? ' OR ep.roleId IN (:...roleIds)' : '') +
            ')',
            { userId, ...(roleIds.length > 0 ? { roleIds } : {}) },
          )
          .getOne();
        if (parentPerm) return true;
      }
    }

    // Fallback: check role-based default permission (viewer can view, editor can edit)
    const roleNames = userRoles.map((r) => r.name);
    if (requiredActions.some((a) => a === 'view') && roleNames.length > 0) {
      return true; // any role can view by default
    }
    if (
      requiredActions.some((a) => ['edit', 'create'].includes(a)) &&
      roleNames.some((r) => ['admin', 'editor'].includes(r))
    ) {
      return true;
    }
    if (
      requiredActions.some((a) => a === 'delete') &&
      roleNames.includes('admin')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Apply permission-based filtering to a query builder for listing entities.
   * Admin sees all; others see entities they own or have explicit permission on.
   */
  applyPermissionFilter<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    userId: string,
    tenantId: string,
    userRoles: string[],
    entityType: string,
  ): SelectQueryBuilder<T> {
    if (userRoles.includes('admin')) {
      return qb;
    }

    if (userRoles.includes('editor')) {
      // Editors see everything they created + anything with explicit permission
      qb.andWhere(
        `(${alias}."createdBy" = :userId OR EXISTS (` +
        `SELECT 1 FROM entity_permissions ep ` +
        `WHERE ep."entityType" = :entityType ` +
        `AND ep."entityId" = ${alias}.id ` +
        `AND ep."tenantId" = :tenantId ` +
        `AND ep.action IN ('view', 'edit') ` +
        `AND (ep."userId" = :userId OR ep."roleId" IS NOT NULL)` +
        `))`,
        { userId, entityType, tenantId },
      );
      return qb;
    }

    // Viewer: only see entities with explicit view permission or own entities
    qb.andWhere(
      `(${alias}."createdBy" = :userId OR EXISTS (` +
      `SELECT 1 FROM entity_permissions ep ` +
      `WHERE ep."entityType" = :entityType ` +
      `AND ep."entityId" = ${alias}.id ` +
      `AND ep."tenantId" = :tenantId ` +
      `AND ep.action = 'view' ` +
      `AND (ep."userId" = :userId OR ep."roleId" IS NOT NULL)` +
      `))`,
      { userId, entityType, tenantId },
    );
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
