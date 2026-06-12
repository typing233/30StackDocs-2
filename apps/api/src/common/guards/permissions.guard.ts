import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import {
  CHECK_PERMISSION_KEY,
  CheckPermissionMeta,
} from '../decorators/permissions.decorator';
import { PermissionsService } from '../../modules/permissions/permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
    private dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<CheckPermissionMeta | undefined>(
      CHECK_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true;
    }

    // Anonymous public users are allowed view actions on public site
    if (user.isAnonymous && meta.action === 'view') {
      return true;
    }

    if (user.roles?.includes('admin')) {
      return true;
    }

    // Special case: parentType='body' means entityId comes from the request body
    if (meta.parentType === 'body') {
      const entityId = request.body[meta.idParam || 'id'];
      if (!entityId) return true;

      const allowed = await this.permissionsService.hasPermission(
        user.id,
        user.tenantId,
        meta.entityType,
        entityId,
        [meta.action],
      );

      if (!allowed) {
        throw new ForbiddenException(
          `No permission to ${meta.action} this ${meta.entityType}`,
        );
      }
      return true;
    }

    // Special case: parentType='slug' means we need to resolve a page by slug
    if (meta.parentType === 'slug') {
      const slug = request.params[meta.idParam || 'slug'];
      if (!slug) return true;

      const page = await this.dataSource.query(
        `SELECT id, "bookId", "chapterId" FROM pages WHERE slug = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL LIMIT 1`,
        [slug, user.tenantId],
      );

      if (!page || page.length === 0) {
        return true; // let the service throw NotFoundException
      }

      const parents: { type: string; id: string }[] = [];
      if (page[0].chapterId) {
        parents.push({ type: 'chapter', id: page[0].chapterId });
      }
      parents.push({ type: 'book', id: page[0].bookId });

      const allowed = await this.permissionsService.hasPermission(
        user.id,
        user.tenantId,
        'page',
        page[0].id,
        [meta.action],
        parents,
      );

      if (!allowed) {
        throw new ForbiddenException(
          `No permission to ${meta.action} this page`,
        );
      }
      return true;
    }

    const entityId = request.params[meta.idParam || 'id'];
    if (!entityId) {
      return true;
    }

    // Build parent chain for hierarchical permission inheritance
    const parents: { type: string; id: string }[] = [];
    if (meta.parentType && meta.parentIdParam && request.params[meta.parentIdParam]) {
      parents.push({
        type: meta.parentType,
        id: request.params[meta.parentIdParam],
      });
    }

    // For page entity type, resolve parents from the database
    if (meta.entityType === 'page' && parents.length === 0) {
      const page = await this.dataSource.query(
        `SELECT "bookId", "chapterId" FROM pages WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
        [entityId, user.tenantId],
      );
      if (page && page.length > 0) {
        if (page[0].chapterId) {
          parents.push({ type: 'chapter', id: page[0].chapterId });
        }
        parents.push({ type: 'book', id: page[0].bookId });
      }
    }

    // For chapter entity type, resolve parent book
    if (meta.entityType === 'chapter' && parents.length === 0) {
      const chapter = await this.dataSource.query(
        `SELECT "bookId" FROM chapters WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
        [entityId, user.tenantId],
      );
      if (chapter && chapter.length > 0) {
        parents.push({ type: 'book', id: chapter[0].bookId });
      }
    }

    const allowed = await this.permissionsService.hasPermission(
      user.id,
      user.tenantId,
      meta.entityType,
      entityId,
      [meta.action],
      parents,
    );

    if (!allowed) {
      throw new ForbiddenException(
        `No permission to ${meta.action} this ${meta.entityType}`,
      );
    }

    return true;
  }
}
