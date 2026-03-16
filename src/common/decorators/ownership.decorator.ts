import { SetMetadata } from '@nestjs/common';

export type OwnershipClaim = 'userId' | 'vendorId' | 'adminId';
export const OWNERSHIP_KEY = 'ownership_claim';

/**
 * Declares which identity claim must be present in the JWT for this route.
 * Use alongside OwnershipGuard to replace manual `if (!vendorId) throw` checks.
 *
 * @example
 * @RequireOwnership('vendorId')
 * @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
 * @Roles(UserRole.VENDOR)
 * async getMyBookings(@CurrentUser() { vendorId }: AuthUser) { ... }
 */
export const RequireOwnership = (claim: OwnershipClaim) =>
  SetMetadata(OWNERSHIP_KEY, claim);
