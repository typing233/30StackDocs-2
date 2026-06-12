import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ConfigService } from '../../modules/config/config.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private defaultTenantId: string | null = null;

  constructor(
    private reflector: Reflector,
    private systemConfigService: ConfigService,
    private dataSource: DataSource,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // Skip JWT validation for API token requests (handled by ApiTokenGuard)
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer sd_')) {
      return true;
    }

    // Allow unauthenticated GET requests when site is public
    if (request.method === 'GET' && !authHeader) {
      const tenantId = await this.resolveDefaultTenant();
      if (tenantId) {
        const sitePublic = await this.systemConfigService.get<boolean>('site.public', tenantId);
        if (sitePublic === true) {
          request.user = {
            id: 'anonymous',
            tenantId,
            roles: ['public'],
            isAnonymous: true,
          };
          return true;
        }
      }
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  private async resolveDefaultTenant(): Promise<string | null> {
    if (this.defaultTenantId) return this.defaultTenantId;
    const rows = await this.dataSource.query(
      `SELECT id FROM tenants ORDER BY "createdAt" ASC LIMIT 1`,
    );
    if (rows.length > 0) {
      this.defaultTenantId = rows[0].id;
    }
    return this.defaultTenantId;
  }
}
