import { Injectable } from '@nestjs/common';
import { AbilityBuilder } from '@casl/ability';
import { AuthUser } from '../../modules/auth/types/auth-user.type';
import { Action, AppAbility, Subject, createMongoAbility } from './app-ability';

/**
 * CaslAbilityFactory builds a MongoAbility instance for the authenticated user.
 *
 * Ownership (e.g. "user can only see their own orders") is enforced at the
 * service layer via userId/vendorId comparisons. This factory handles
 * role-level permissions only — what type of operations each role can perform.
 *
 * To add a new permission:
 *  1. Add the Subject to app-ability.ts if not already present.
 *  2. Add `can(Action.X, 'Subject')` in the relevant role block below.
 */
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: AuthUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    const roles: string[] = Array.isArray(user.role) ? user.role : [];

    // ─── Admin: full access to everything ───────────────────────────────────
    // Guard: adminId must be present in the JWT for admin abilities to apply.
    // This prevents a token that carries the 'admin' role string but was
    // issued without a real adminId from bypassing authorization.
    if (roles.includes('admin') && user.adminId) {
      can(Action.Manage, 'all');
      return build();
    }

    // ─── User: manages their own cart, drafts, checkout, and orders ─────────
    // Guard: userId must be present. A vendor-only JWT that happens to carry
    // 'user' in the roles array without a userId will not gain these abilities.
    if (roles.includes('user') && user.userId) {
      can(Action.Create, [
        'Order',
        'Cart',
        'DraftCart',
        'CheckoutIntent',
      ] as Subject[]);
      can(Action.Read, [
        'Order',
        'Cart',
        'DraftCart',
        'CheckoutIntent',
        'VendorAvailability', // needed to check vendor availability during booking
      ] as Subject[]);
      can(Action.Update, ['Cart', 'DraftCart'] as Subject[]);
      can(Action.Delete, ['Cart', 'DraftCart'] as Subject[]);
    }

    // ─── Vendor: manages their own availability, add-ons, and bookings ──────
    // Guard: vendorId must be present. Same protection as above.
    if (roles.includes('vendor') && user.vendorId) {
      can(Action.Manage, 'VendorAvailability');
      can(Action.Manage, 'AddOn');
      can(Action.Read, 'Order');
      can(Action.Update, 'Vendor');
    }

    return build();
  }
}
