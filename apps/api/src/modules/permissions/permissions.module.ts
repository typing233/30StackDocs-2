import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsService } from './permissions.service';
import { RoleEntity } from './entities/role.entity';
import { EntityPermission } from './entities/entity-permission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity, EntityPermission])],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
