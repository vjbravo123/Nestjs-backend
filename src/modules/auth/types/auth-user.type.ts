// src/auth/interfaces/auth-user.interface.ts
import { Types } from 'mongoose';
import { UserRole } from '../../../common/enums/user-role.enum';

export interface AuthUser {
    userId?: Types.ObjectId;
    vendorId?: Types.ObjectId;
    authId?: Types.ObjectId;
    adminId?: Types.ObjectId;
    email?: string;
    /** Active role for this session — e.g. 'user' or 'vendor' (set in JWT payload) */
    currentRole?: string;
    /** All roles this account holds — e.g. ['user', 'vendor'] */
    role: (UserRole | string)[];
}
