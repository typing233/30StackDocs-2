import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiTokensService } from '../../modules/api-tokens/api-tokens.service';

const IDEMPOTENCY_HEADER = 'idempotency-key';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const idempotencyKey = request.headers[IDEMPOTENCY_HEADER];

    if (!idempotencyKey || request.method === 'GET') {
      return next.handle();
    }

    const tenantId = request.user?.tenantId;
    if (!tenantId) return next.handle();

    // Check if we already have a response for this key
    const existing = await this.apiTokensService.getIdempotencyResponse(idempotencyKey, tenantId);
    if (existing) {
      response.status(existing.statusCode);
      return of(existing.body);
    }

    // Process request and store result
    return next.handle().pipe(
      tap(async (responseBody) => {
        const statusCode = response.statusCode;
        await this.apiTokensService.storeIdempotencyResponse(
          idempotencyKey,
          tenantId,
          request.method,
          request.path,
          statusCode,
          responseBody,
        ).catch(() => {});
      }),
    );
  }
}
