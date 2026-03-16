import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

// @Injectable()
// export class RolesGuard implements CanActivate {
//     constructor(private reflector: Reflector) { }

//     canActivate(context: ExecutionContext): boolean {
//         const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
//             context.getHandler(),
//             context.getClass(),
//         ]);
//         if (!requiredRoles) {
//             return true;
//         }
//         const { user } = context.switchToHttp().getRequest();
//         console.log("user in auth", user)
//         console.log("requiredRoles", requiredRoles)

//         if (!user || !requiredRoles.includes(user.role)) {
//             throw new ForbiddenException('You do not have the required role');
//         }
//         return true;
//     }
// }

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();

    // Support both string and array for user.role/roles
    const userRoles: string[] = Array.isArray(user.role)
      ? user.role
      : Array.isArray(user.roles)
        ? user.roles
        : [user.role || user.roles].filter(Boolean);

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));
    if (!user || !hasRole) {
      throw new ForbiddenException('You do not have the required role');
    }
    return true;
  }
}
