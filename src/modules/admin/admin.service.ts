import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Admin, AdminDocument as AdminDocBase } from './admin.schema';
import { TokenService } from '../token/token.service'
import { AdminLoginDto } from './admin-login.dto';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Get } from '@nestjs/common';

export interface AdminDocument extends AdminDocBase {
    isPasswordMatch(inputPassword: string): Promise<boolean>;
}

@Injectable()
export class AdminService {
    constructor(
        @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
        private readonly jwtService: JwtService,
        private readonly tokenService: TokenService,
    ) { }

    private readonly MAX_FAILED_ATTEMPTS = 5;
    private readonly LOCK_TIME = 30 * 60 * 1000; // 30 minutes

    async validateAdminLogin(dto: AdminLoginDto, deviceInfo?: string, ip?: string, userAgent?: string): Promise<{ admin: any, accessToken: string, refreshToken: string, jti: string }> {
        console.log("email dto", dto.email)
        const admin = await this.adminModel.findOne({ email: dto.email }).select('+password');
        if (!admin) throw new UnauthorizedException('Invalid credentials');

        // Check if account is locked
        if (admin.lockUntil && admin.lockUntil > new Date()) {
            throw new ForbiddenException('Account is temporarily locked due to too many failed login attempts.');
        }

        const isMatch = await admin.isPasswordMatch(dto.password);
        if (!isMatch) {
            admin.failedLoginAttempts += 1;
            // Lock account if too many failed attempts
            if (admin.failedLoginAttempts >= this.MAX_FAILED_ATTEMPTS) {
                admin.lockUntil = new Date(Date.now() + this.LOCK_TIME);
                await admin.save();
                throw new ForbiddenException('Account locked due to too many failed login attempts.');
            }
            await admin.save();
            throw new UnauthorizedException('Invalid credentials');
        }

        admin.failedLoginAttempts = 0;
        admin.lockUntil = undefined;
        admin.lastLogin = new Date();
        await admin.save();


        const jti = randomUUID();
        const payload = {
            sub: admin._id || '',
            // email: admin.email || '',
            role: admin.role || 'admin',
            tokenVersion: admin.tokenVersion || 0,
            // device: deviceInfo || '',
            // ip: ip || '',
            jti,
        };
        console.log('Payload during the login ', payload)
        console.log('admin during the login ', admin)

        const accessToken = this.jwtService.sign(payload, { expiresIn: '1d' });
        const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        return {
            admin: { ...admin.toObject(), _id: String(admin._id) },
            accessToken,
            refreshToken,
            jti,
        };
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @Get('dashboard')
    getDashboard() {
        // Implementation of getDashboard method
    }

    async refreshAccessToken(
        refreshToken: string,
        deviceInfo: string,
        ip: string,
        userAgent: string,
    ): Promise<{
        accessToken: string;
        refreshToken: string;
        jti: string;
        adminId: string;
        userAgent: string;
    }> {
        const payload = this.jwtService.verify(refreshToken);
        if (payload.device !== deviceInfo || payload.ip !== ip) {
            throw new UnauthorizedException('Device or IP mismatch');
        }
        const admin = await this.adminModel.findById(payload.sub);
        console.log("admin in the ", admin)
        console.log("Payload", payload)
        if (!admin || admin.tokenVersion !== payload.tokenVersion) {
            throw new UnauthorizedException('Token revoked or user not found');
        }

        const session = await this.tokenService.findByJti(payload.jti);
        if (!session || session.isRevoked) {
            throw new ForbiddenException('Invalid session');
        }

        if (session.ip !== ip || session.userAgent !== userAgent) {
            throw new ForbiddenException('Device or IP mismatch with session');
        }
        console.log("refreshToken", refreshToken)
        console.log("session", session)
        const isValid = await bcrypt.compare(refreshToken, session.refreshTokenHash);
        if (!isValid) {
            throw new ForbiddenException('Invalid refresh token');
        }

        // Revoke old session
        session.isRevoked = true;
        await session.save();

        // Create new session with new tokens
        const newJti = randomUUID();
        const newPayload = {
            sub: payload.sub,
            role: 'admin',
            jti: newJti,
            email: admin.email,
            tokenVersion: admin.tokenVersion || 0,
            device: deviceInfo,
            ip: ip,
        };


        const newAccessToken = this.jwtService.sign(newPayload, { expiresIn: '1d' });
        const newRefreshToken = this.jwtService.sign(newPayload, { expiresIn: '7d' });

        await this.tokenService.createToken({
            adminId: payload.sub,
            jti: newJti,
            ip,
            userAgent,
            refreshTokenHash: await bcrypt.hash(newRefreshToken, 10),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

        return {
            adminId: String(admin._id),
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            jti: newJti,
            userAgent,
        };

    }


    async getAdminByEmail() {

    }

    /**
     * Increment token version to invalidate all existing tokens
     * This is useful for security purposes like password change, logout from all devices, etc.
     */
    async incrementTokenVersion(adminId: string): Promise<void> {
        const admin = await this.adminModel.findById(adminId);
        if (!admin) {
            throw new UnauthorizedException('Admin not found');
        }

        admin.tokenVersion = (admin.tokenVersion || 0) + 1;
        await admin.save();

        console.log(`Token version incremented for admin ${adminId} to ${admin.tokenVersion}`);
    }

    /**
     * Logout from all devices by incrementing token version
     */
    async logoutFromAllDevices(adminId: string): Promise<{ message: string }> {
        await this.incrementTokenVersion(adminId);
        return { message: 'Logged out from all devices successfully' };
    }

    /**
     * Get current token version for an admin
     */
    async getTokenVersion(adminId: string): Promise<number> {
        const admin = await this.adminModel.findById(adminId).select('tokenVersion');
        if (!admin) {
            throw new UnauthorizedException('Admin not found');
        }
        return admin.tokenVersion || 0;
    }
}