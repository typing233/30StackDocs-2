import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermissionsService } from './permissions.service';

@Controller('api/permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // --- Roles ---
  @Get('roles')
  async listRoles(@CurrentUser() user: any) {
    const roles = await this.permissionsService.listRoles(user.tenantId);
    return { data: roles };
  }

  @Post('roles')
  @Roles('admin')
  async createRole(@CurrentUser() user: any, @Body() body: { name: string; description?: string; permissions?: string[] }) {
    const role = await this.permissionsService.createRole({
      name: body.name,
      description: body.description || null,
      tenantId: user.tenantId,
      permissions: body.permissions || [],
      isSystem: false,
    });
    return { data: role };
  }

  @Put('roles/:id')
  @Roles('admin')
  async updateRole(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { name?: string; description?: string; permissions?: string[] }) {
    const role = await this.permissionsService.updateRole(id, user.tenantId, body);
    return { data: role };
  }

  @Delete('roles/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRole(@CurrentUser() user: any, @Param('id') id: string) {
    await this.permissionsService.deleteRole(id, user.tenantId);
  }

  // --- Entity Permissions ---
  @Post('entity')
  @Roles('admin')
  async grantPermission(@CurrentUser() user: any, @Body() body: {
    entityType: string;
    entityId: string;
    action: string;
    userId?: string;
    roleId?: string;
    effect?: string;
    priority?: number;
  }) {
    if (!body.userId && !body.roleId) {
      throw new BadRequestException('Either userId or roleId must be provided');
    }
    const perm = await this.permissionsService.grantPermission(
      user.tenantId,
      body.entityType,
      body.entityId,
      body.action,
      body.userId,
      body.roleId,
      body.effect || 'allow',
      body.priority || 0,
    );
    return { data: perm };
  }

  @Get('entity/:entityType/:entityId')
  @Roles('admin')
  async getEntityPermissions(
    @CurrentUser() user: any,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    const perms = await this.permissionsService.getPermissionsForEntity(user.tenantId, entityType, entityId);
    return { data: perms };
  }

  @Delete('entity/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokePermission(@CurrentUser() user: any, @Param('id') id: string) {
    await this.permissionsService.revokePermission(id, user.tenantId);
  }

  // --- ABAC Policies ---
  @Get('policies')
  @Roles('admin')
  async listPolicies(@CurrentUser() user: any) {
    const policies = await this.permissionsService.listAbacPolicies(user.tenantId);
    return { data: policies };
  }

  @Post('policies')
  @Roles('admin')
  async createPolicy(@CurrentUser() user: any, @Body() body: {
    name: string;
    description?: string;
    entityType: string;
    action: string;
    effect: string;
    priority?: number;
    conditions: Record<string, any>;
  }) {
    const policy = await this.permissionsService.createAbacPolicy({
      ...body,
      tenantId: user.tenantId,
      createdBy: user.id,
      priority: body.priority || 0,
    });
    return { data: policy };
  }

  @Put('policies/:id')
  @Roles('admin')
  async updatePolicy(@CurrentUser() user: any, @Param('id') id: string, @Body() body: Partial<{
    name: string;
    description: string;
    effect: string;
    priority: number;
    conditions: Record<string, any>;
    enabled: boolean;
  }>) {
    const policy = await this.permissionsService.updateAbacPolicy(id, user.tenantId, body);
    return { data: policy };
  }

  @Delete('policies/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePolicy(@CurrentUser() user: any, @Param('id') id: string) {
    await this.permissionsService.deleteAbacPolicy(id, user.tenantId);
  }
}
