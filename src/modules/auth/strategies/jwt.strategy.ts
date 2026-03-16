import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Types } from 'mongoose';
import { array } from 'joi';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'your-secret-key', // Use environment variable in production
        });
    }

    async validate(payload: any) {
        // 'sub' contains the authId (standard JWT subject claim)
        // 'roles' is the array of roles, 'role' might be legacy single role
        const roles = payload.roles || (Array.isArray(payload.role) ? payload.role : [payload.role]);

        return {
            userId: payload.userId ? new Types.ObjectId(payload.userId) : null,
            vendorId: payload.vendorId ? new Types.ObjectId(payload.vendorId) : null,
            authId: payload.authId ? new Types.ObjectId(payload.authId) : null,
            email: payload.email || null,
            role: roles,
            currentRole: payload.currentRole || null,
            adminId: payload.sub ? new Types.ObjectId(payload.adminId) : null,
        };
    }

}