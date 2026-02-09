import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';

export interface DeviceInfo {
    ip: string | string[];
    userAgent: string;
}

interface Session {
    token: string; // hashed refresh token
    device: DeviceInfo;
    lastUsed: Date;
}

interface TokenPayload {
    _id: Types.ObjectId | string;
    email: string;
    mobile?: number;
    role: string;
    tokenVersion: number;
    device: DeviceInfo;
    userId?: string;
    [key: string]: any;
}

@Injectable()
export class TokenService {
    private readonly MAX_ACTIVE_SESSIONS = 5;

    constructor(private jwtService: JwtService) { }

    // Generate access & refresh tokens
    async generateTokens(entity: any, device: DeviceInfo) {
        const tokenVersion = typeof entity.tokenVersion === 'number' ? entity.tokenVersion : 0;
        const newTokenVersion = tokenVersion + 1;
        console.log("entity in generateTokens", entity);
        const payload: TokenPayload = {
            // _id: entity._id.toString(),
            email: entity.email,
            mobile: entity.mobile,
            role: entity.roles,
            tokenVersion: newTokenVersion,
            device,
            ...(entity.userId && { userId: entity.userId.toString() }),
            ...(entity.vendorId && { vendorId: entity.vendorId.toString() }),
            ...(entity.authId && { authId: entity.authId.toString() }),
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                expiresIn: process.env.JWT_EXPIRES_IN || '1d',
            }),
            this.jwtService.signAsync(payload, {
                expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
            }),
        ]);

        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

        if ('activeSessions' in entity) {
            await this.updateSessions(entity, hashedRefreshToken, device, newTokenVersion);
        }

        return { accessToken, refreshToken };
    }

    // Update sessions, keep max sessions
    private async updateSessions(
        entity: any,
        hashedToken: string,
        device: DeviceInfo,
        tokenVersion: number
    ) {
        const sessions: Session[] = entity.activeSessions ? [...entity.activeSessions] : [];
        if (sessions.length >= this.MAX_ACTIVE_SESSIONS) sessions.shift();
        sessions.push({ token: hashedToken, device, lastUsed: new Date() });

        await entity.constructor.updateOne(
            { _id: entity._id },
            { $set: { activeSessions: sessions, tokenVersion } }
        );
    }
    async verifyAccessToken(token: string) {
        console.log("token in verifyAccessToken:", token);
        try {
            const decoded = await this.jwtService.verifyAsync(token, {
                secret: process.env.JWT_SECRET,
            });
            console.log("✅ Token verified successfully:", decoded);
            return decoded;
        } catch (err) {
            console.error("❌ JWT verification error:", err.message);
            // rethrow so upper layers can handle
            throw new UnauthorizedException("Invalid access token: " + err.message);
        }
    }

    async verifyRefreshToken(token: string) {
        try {
            return await this.jwtService.verifyAsync(token);
        } catch (err) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async validateSession(entity: any, refreshToken: string, tokenVersion: number) {
        const session = (entity.activeSessions || []).find(s =>
            bcrypt.compareSync(refreshToken, s.token)
        );

        if (!session || tokenVersion !== entity.tokenVersion) {
            throw new UnauthorizedException('Invalid or expired session');
        }

        return session;
    }

    // Invalidate sessions (single or all devices)
    async invalidateSessions(entity: any, allDevices = false) {
        if (allDevices) {
            await entity.constructor.updateOne(
                { _id: entity._id },
                { $set: { activeSessions: [] }, $inc: { tokenVersion: 1 } }
            );
        } else {
            await entity.constructor.updateOne(
                { _id: entity._id },
                { $inc: { tokenVersion: 1 } }
            );
        }
    }
}
