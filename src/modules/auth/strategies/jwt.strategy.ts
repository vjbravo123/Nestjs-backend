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
        console.log("payload in jwt strategy", payload);

        return {
            userId: payload.userId ? new Types.ObjectId(payload.userId) : null,
            vendorId: payload.vendorId ? new Types.ObjectId(payload.vendorId) : null,
            authId: payload.authId ? new Types.ObjectId(payload.authId) : null,
            email: payload.email || null,
            role: Array.isArray(payload.role) ? payload.role : [payload.role],
            adminId: payload.sub ? new Types.ObjectId(payload.sub) : null,
        };
    }

}