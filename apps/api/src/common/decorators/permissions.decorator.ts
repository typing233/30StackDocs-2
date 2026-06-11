import { SetMetadata } from '@nestjs/common';

export interface CheckPermissionMeta {
  entityType: string;
  action: string;
  /** The route param name containing the entity ID (default: 'id') */
  idParam?: string;
  /**
   * For nested resources: parent entity type to check inherited permissions.
   * Special values:
   *   'body' — idParam is read from request.body instead of route params
   *   'slug' — idParam holds a slug; the guard resolves the page by slug
   * Otherwise: specifies the parent entity type for route-param-based parent lookup.
   */
  parentType?: string;
  /** Route param containing the parent entity ID */
  parentIdParam?: string;
}

export const CHECK_PERMISSION_KEY = 'check_permission';

export const CheckPermission = (meta: CheckPermissionMeta) =>
  SetMetadata(CHECK_PERMISSION_KEY, meta);

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
