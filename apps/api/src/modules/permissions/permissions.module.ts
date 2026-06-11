import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsService } from './permissions.service';
import { RoleEntity } from './entities/role.entity';
import { EntityPermission } from './entities/entity-permission.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity, EntityPermission])],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
