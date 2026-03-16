import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * @description Extracts the authenticated user object from the request.
 * This decorator relies on the `JwtStrategy` attaching `user` to `request`.
 *
 * Usage:
 * ```ts
 * @Get()
 * async getProfile(@CurrentUser() user: AuthUser) {
 *   return user;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request>();

    // JwtStrategy attaches `user` to the request after token validation
    return request.user;
  },
);
