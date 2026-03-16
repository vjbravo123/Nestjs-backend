import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CHECK_POLICIES_KEY, PolicyHandler } from './check-policies.decorator';
import { AuthUser } from '../../modules/auth/types/auth-user.type';

/**
 * PoliciesGuard evaluates @CheckPolicies() handlers against the caller's ability.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, PoliciesGuard)
 *   @CheckPolicies(ability => ability.can(Action.Create, 'Order'))
 *   async createOrder(...) {}
 *
 * - Must be used AFTER JwtAuthGuard (relies on request.user being populated).
 * - Attaches the ability to request.ability for optional downstream service use.
 * - Routes with no @CheckPolicies() decorator are permitted (no policy = no restriction).
 *   Use @Roles() + RolesGuard for purely role-based routes without conditions.
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const policyHandlers =
      this.reflector.getAllAndOverride<PolicyHandler[]>(CHECK_POLICIES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const request = context.switchToHttp().getRequest();
    const user: AuthUser = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const ability = this.caslAbilityFactory.createForUser(user);

    // Attach to request so services can optionally run subject-level checks
    request.ability = ability;

    const passed = policyHandlers.every((handler) => handler(ability));
    if (!passed) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
