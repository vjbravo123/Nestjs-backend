import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  OWNERSHIP_KEY,
  OwnershipClaim,
} from '../decorators/ownership.decorator';

/**
 * Validates that the authenticated user's JWT contains the required identity
 * claim declared via @RequireOwnership().
 *
 * This eliminates scattered `if (!vendorId) throw new ForbiddenException()`
 * checks from controllers and services.
 *
 * Must be used AFTER JwtAuthGuard so that `request.user` is populated.
 *
 * @example
 * @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
 * @Roles(UserRole.VENDOR)
 * @RequireOwnership('vendorId')
 * async getMyBookings() { ... }
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const claim = this.reflector.getAllAndOverride<OwnershipClaim>(
      OWNERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No ownership claim required — pass through
    if (!claim) return true;

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    if (!user[claim]) {
      throw new ForbiddenException(
        `Access denied: missing identity claim '${claim}' in token`,
      );
    }

    return true;
  }
}
