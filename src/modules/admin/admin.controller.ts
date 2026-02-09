import {
    Controller,
    Post,
    Body,
    HttpCode,
    UseGuards,
    Req,
    Res,
    UnauthorizedException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { TokenService } from '../token/token.service';
import { AdminLoginDto } from './admin-login.dto';
import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';

@Controller('admin')
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly tokenService: TokenService,
    ) { }

    // ✅ Apply per-route throttling: 5 requests per 60 seconds
    @Post('login')
    @HttpCode(200)
    // Throttling is handled globally in AppModule
    async login(
        @Body() dto: AdminLoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const deviceInfo = req.headers['user-agent'] || '';
        const forwarded = req.headers['x-forwarded-for'] as string;
        const ip = (forwarded || req.ip || req.socket.remoteAddress || '').split(',')[0].trim();
        const userAgent = deviceInfo;

        const {
            admin,
            accessToken,
            refreshToken,
            jti,
        } = await this.adminService.validateAdminLogin(dto, deviceInfo, ip, userAgent);

        // Hash the refresh token before storing
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        await this.tokenService.createToken({
            adminId: admin._id.toString(),
            jti,
            ip,
            userAgent,
            refreshTokenHash,
            isRevoked: false,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

        res.cookie('admin_refresh_token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/admin',
        });

        return {
            message: 'Admin login successful',
            accessToken,
            admin,
        };
    }

    @Post('refresh')
    @HttpCode(200)
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const refreshToken = req.cookies['admin_refresh_token'];

        if (!refreshToken) {
            throw new UnauthorizedException('No refresh token provided');
        }

        const deviceInfo = req.headers['user-agent'] || '';
        const forwarded = req.headers['x-forwarded-for'] as string;
        const ip = (forwarded || req.ip || req.socket.remoteAddress || '').split(',')[0].trim();


        const {
            accessToken,
            refreshToken: newRefreshToken,
            jti,
            adminId,
            userAgent,
        } = await this.adminService.refreshAccessToken(refreshToken, deviceInfo, ip, deviceInfo);

        // Hash the new refresh token before storing
        const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
        await this.tokenService.createToken({
            adminId: adminId.toString(),
            jti,
            ip,
            userAgent,
            refreshTokenHash: newRefreshTokenHash,
            isRevoked: false,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        res.cookie('admin_refresh_token', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/admin/refresh',
        });

        return { accessToken };

    }

    @Post('logout')
    @HttpCode(200)
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        console.log("req.cookies", req.cookies)
        const refreshToken = req.cookies['admin_refresh_token'];


        console.log("refreshToken", refreshToken)
        if (!refreshToken) {
            throw new UnauthorizedException('No refresh token provided');
        }
        // Decode the token to get the jti
        let payload: any;

        payload = this.tokenService['jwtService'].verify(refreshToken);

        // Revoke the token in the DB
        await this.tokenService.revokeToken(payload.jti);
        // Clear the cookie
        res.clearCookie('admin_refresh_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/admin',
        });
        return { message: 'Logged out successfully' };
    }
}
