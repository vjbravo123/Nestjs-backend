// src/auth/interfaces/auth-user.interface.ts
import { Types } from 'mongoose';

export interface AuthUser {
    userId?: Types.ObjectId;
    vendorId?: Types.ObjectId;
    authId?: Types.ObjectId;
    adminId?: Types.ObjectId;
    email?: string;
    role: string[];
}
