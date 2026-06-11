import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async hasPermission(
    userId: string,
    tenantId: string,
    entityType: string,
    entityId: string,
    requiredActions: string[],
  ): Promise<boolean> {
    const permission = await this.permRepo
      .createQueryBuilder('ep')
      .where('ep.tenantId = :tenantId', { tenantId })
      .andWhere('ep.entityType = :entityType', { entityType })
      .andWhere('ep.entityId = :entityId', { entityId })
      .andWhere('ep.action IN (:...actions)', { actions: requiredActions })
      .andWhere('(ep.userId = :userId OR ep.roleId IS NOT NULL)', { userId })
      .getOne();

    return !!permission;
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
}
