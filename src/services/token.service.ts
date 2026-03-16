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
    // tokenVersion is NOT incremented here — it only increments on force-logout
    // (invalidateSessions). This allows multiple devices to stay logged in
    // simultaneously without invalidating each other's sessions.
    const tokenVersion =
      typeof entity.tokenVersion === 'number' ? entity.tokenVersion : 0;

    const payload: any = {
      // Standard JWT subject claim (authId)
      ...(entity.authId && { authId: entity.authId }),
      email: entity.email,
      mobile: entity.mobile,
      roles: entity.roles, // Array of roles
      currentRole: entity.currentRole, // Current active role
      tokenVersion, // Reflects current version — will fail if force-logout increments it
      device,
      ...(entity.userId && { userId: entity.userId.toString() }),
      ...(entity.vendorId && { vendorId: entity.vendorId.toString() }),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: process.env.JWT_EXPIRES_IN || ('7d' as any),
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || ('7d' as any),
      }),
    ]);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    if ('activeSessions' in entity) {
      await this.updateSessions(entity, hashedRefreshToken, device);
    }

    return { accessToken, refreshToken };
  }

  // Update sessions, keep max sessions
  // Does NOT update tokenVersion — that only happens during force-logout
  private async updateSessions(
    entity: any,
    hashedToken: string,
    device: DeviceInfo,
  ) {
    const sessions: Session[] = entity.activeSessions
      ? [...entity.activeSessions]
      : [];
    if (sessions.length >= this.MAX_ACTIVE_SESSIONS) sessions.shift();
    sessions.push({ token: hashedToken, device, lastUsed: new Date() });

    await entity.constructor.updateOne(
      { _id: entity._id },
      { $set: { activeSessions: sessions } },
    );
  }
  async verifyAccessToken(token: string) {
    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      return decoded;
    } catch (err) {
      console.error('❌ JWT verification error:', err.message);
      // rethrow so upper layers can handle
      throw new UnauthorizedException('Invalid access token: ' + err.message);
    }
  }

  async verifyRefreshToken(token: string) {
    try {
      return await this.jwtService.verifyAsync(token);
    } catch (err) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateSession(
    entity: any,
    refreshToken: string,
    tokenVersion: number,
  ) {
    const session = (entity.activeSessions || []).find((s) =>
      bcrypt.compareSync(refreshToken, s.token),
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
        { $set: { activeSessions: [] }, $inc: { tokenVersion: 1 } },
      );
    } else {
      await entity.constructor.updateOne(
        { _id: entity._id },
        { $inc: { tokenVersion: 1 } },
      );
    }
  }
}
