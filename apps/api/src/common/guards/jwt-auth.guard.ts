import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ConfigService } from '../../modules/config/config.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private systemConfigService: ConfigService,
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
      const sitePublic = await this.systemConfigService.get<boolean>('site.public', undefined);
      if (sitePublic === true) {
        request.user = {
          id: 'anonymous',
          tenantId: null,
          roles: ['public'],
          isAnonymous: true,
        };
        return true;
      }
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
