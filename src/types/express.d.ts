import { AuthUser } from '../modules/auth/types/auth-user.type';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
