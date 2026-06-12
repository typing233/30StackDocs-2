import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiTokensService } from '../../modules/api-tokens/api-tokens.service';

export const API_TOKEN_SCOPE_KEY = 'api_token_scope';

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private apiTokensService: ApiTokensService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] || '';

    // Only process API token requests (prefix "Bearer sd_")
    if (!authHeader.startsWith('Bearer sd_')) {
      return true; // Let JWT guard handle it
    }

    const token = authHeader.replace('Bearer ', '');
    const tokenData = await this.apiTokensService.validateToken(token);

    // Check rate limit
    const allowed = await this.apiTokensService.checkRateLimit(
      tokenData.tokenId,
      60, // default; ideally loaded from token
    );
    if (!allowed) {
      throw new UnauthorizedException('Rate limit exceeded for this API token');
    }

    // Check scope if required
    const requiredScope = this.reflector.getAllAndOverride<string>(API_TOKEN_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredScope) {
      this.apiTokensService.checkScope(tokenData.scopes, requiredScope);
    }

    // Set user on request for downstream guards/handlers
    request.user = {
      id: tokenData.userId,
      tenantId: tokenData.tenantId,
      roles: ['api-token'],
      tokenScopes: tokenData.scopes,
      isApiToken: true,
    };

    return true;
  }
}
