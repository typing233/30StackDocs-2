import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../modules/audit/audit.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(() => {
        const request = context.switchToHttp().getRequest();
        const method = request.method;

        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          const entityType = this.extractEntityType(request.route?.path || '');
          this.auditService.log({
            userId: request.user?.id || null,
            tenantId: request.user?.tenantId,
            action: `${method} ${request.route?.path || request.url}`,
            entityType,
            entityId: request.params?.id || null,
            changes: this.sanitizeBody(request.body),
            ip: request.ip,
          });
        }
      }),
    );
  }

  private extractEntityType(path: string): string | null {
    if (path.includes('books')) return 'book';
    if (path.includes('chapters')) return 'chapter';
    if (path.includes('pages')) return 'page';
    if (path.includes('auth')) return 'auth';
    return null;
  }

  private sanitizeBody(body: any): Record<string, any> | null {
    if (!body) return null;
    const sanitized = { ...body };
    delete sanitized.password;
    delete sanitized.passwordHash;
    return sanitized;
  }
}
