import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_LOG_KEY } from '../decorators/audit-log.decorator';
import logger from '../utils/logger';

/**
 * Logs admin actions for audit trail purposes.
 * Captures: adminId, method, URL, status code, and duration.
 *
 * Only fires when the route is decorated with @AuditLog() or
 * when applied globally to an admin controller.
 *
 * Register globally in AppModule or apply per-controller:
 * @UseInterceptors(AdminAuditInterceptor)
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const shouldAudit = this.reflector.getAllAndOverride<boolean>(
      AUDIT_LOG_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!shouldAudit) return next.handle();

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, user } = request;
    const adminId = user?.adminId ?? 'unknown';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          logger.info(
            `[ADMIN AUDIT] adminId=${adminId} ${method} ${url} ${response.statusCode} +${ms}ms`,
          );
        },
        error: (err) => {
          const ms = Date.now() - start;
          logger.warn(
            `[ADMIN AUDIT] adminId=${adminId} ${method} ${url} ERROR(${err?.status ?? 500}) +${ms}ms`,
          );
        },
      }),
    );
  }
}
