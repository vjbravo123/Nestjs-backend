import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';

/**
 * Marks a controller or route handler for admin audit logging.
 * Apply to any admin route to capture a tamper-evident log entry via AdminAuditInterceptor.
 *
 * @example
 * @AuditLog()
 * @Roles(UserRole.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * async approveVendor(...) { ... }
 */
export const AuditLog = () => SetMetadata(AUDIT_LOG_KEY, true);
