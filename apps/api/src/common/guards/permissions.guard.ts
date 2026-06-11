import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionsService } from '../../modules/permissions/permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user.roles?.includes('admin')) {
      return true;
    }

    const entityId = request.params.id || request.params.bookId;
    if (!entityId) {
      return true;
    }

    const entityType = this.extractEntityType(request.route.path);
    return this.permissionsService.hasPermission(
      user.id,
      user.tenantId,
      entityType,
      entityId,
      requiredPermissions,
    );
  }

  private extractEntityType(path: string): string {
    if (path.includes('books')) return 'book';
    if (path.includes('chapters')) return 'chapter';
    if (path.includes('pages')) return 'page';
    return 'unknown';
  }
}
