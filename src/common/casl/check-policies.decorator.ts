import { SetMetadata } from '@nestjs/common';
import { AppAbility } from './app-ability';

export const CHECK_POLICIES_KEY = 'check_policies';

/**
 * A policy handler is a plain function that receives the caller's ability
 * and returns true if the action is permitted, false otherwise.
 *
 * @example
 *   ability => ability.can(Action.Create, 'Order')
 */
export type PolicyHandler = (ability: AppAbility) => boolean;

/**
 * Attach one or more policy handlers to a route handler.
 * The PoliciesGuard evaluates all handlers and throws ForbiddenException
 * if any of them returns false.
 *
 * @example
 *   @CheckPolicies(ability => ability.can(Action.Read, 'Order'))
 *   async getOrder() { ... }
 */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
