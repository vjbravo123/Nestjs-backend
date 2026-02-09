

import {
    Controller,
    Post,
    Body,
    HttpCode,
    Req,
    Res,
    Query,
    Get,
    UseGuards,
    UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateVendorDtoStep1 } from './dto/create-vendor.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import logger from '../../common/utils/logger';
import { Types } from 'mongoose';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthUser } from './types/auth-user.type';
import { Vendor } from 'src/modules/vendor/vendor.schema';



interface JwtUser {
    userId: Types.ObjectId;
    vendorId?: Types.ObjectId;
    authId: Types.ObjectId;
    email: string;
    role: string[];
    adminId?: Types.ObjectId | null;
}
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {
        logger.info('AuthController initialized');
    }

    // -------------------- User Registration --------------------
    @Post('register-user')
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User successfully created' })
    async register(@Body() createUserDto: CreateUserDto) {
        return this.authService.register(createUserDto);
    }

    // -------------------- Vendor Registration --------------------
    @Post('register-vendor')
    @ApiOperation({ summary: 'Register a new vendor' })
    @ApiResponse({ status: 201, description: 'Vendor successfully created' })
    async registerVendor(@Body() createVendorDto: CreateVendorDtoStep1) {
        return this.authService.registerVendor(createVendorDto);
    }

    @Post('vendor/force')
    async forceRegister(@Query('mobile') mobile: number) {
        return this.authService.forceRegisterVendor(mobile);
    }

    // -------------------- Login (user/vendor combined) --------------------
    @Post('login')
    @HttpCode(200)
    async login(
        @Body() loginDto: LoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        // 1️⃣ Authenticate and generate tokens
        const { accessToken, refreshToken, role, publicData } = await this.authService.login(loginDto, req);

        // 2️⃣ Determine frontend origin (for local vs production cookie settings)
        const origin = req.headers.origin as string;
        const isLocal = origin?.includes('localhost');
        console.log('Login origin:', origin, 'isLocal:', isLocal);
        logger.info(`Login origin: ${origin}, isLocal: ${isLocal}`);
        // console.log("Refresh Token during login:", refreshToken);
        // 3️⃣ Set refresh token in secure HTTP-only cookie
        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: !isLocal,             // true for HTTPS, false for localhost
            sameSite: isLocal ? 'lax' : 'none', // lax for localhost, none for cross-domain HTTPS
            path: '/',                     // cookie valid across all routes
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // 4️⃣ Return response with access token and public data
        return {
            message: 'Login successful',
            accessToken,
            role,
            [role]: publicData,
        };
    }



    @Post('vendor-to-user-login')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    @HttpCode(200)
    async vendorToUserLogin(
        @Req() req: Request,
        @CurrentUser() auth: AuthUser,
        @Res({ passthrough: true }) res: Response
    ) {



        const result = await this.authService.switchToUser(auth, req);

        // detect local vs production
        const origin = req.headers.origin as string;
        const isLocal = origin?.includes('localhost');

        res.cookie('refresh_token', result.refreshToken, {
            httpOnly: true,
            secure: !isLocal,
            sameSite: isLocal ? 'lax' : 'none',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return {
            message: "Switched to user successfully",
            accessToken: result.accessToken,
            role: 'user'

        };
    }




    // switch vendor to user login
    @Post('switch-to-vendor')
    @HttpCode(200)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('user')
    async switchToVendor(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const user = req.user as JwtUser; // ✅ Cast to our defined type
        console.log("req.user in switchToVendor:", user);
        if (!user?.vendorId) {
            throw new UnauthorizedException('Not Accessible');
        }

        const result = await this.authService.switchToVendor(user, req);

        const { accessToken, refreshToken } = result;

        // detect origin to set cookie mode
        const origin = (req.headers.origin as string) || process.env.FRONTEND_URL || 'http://localhost:3000';
        const isLocal = origin.includes('localhost');

        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: !isLocal,
            sameSite: isLocal ? 'lax' : 'none',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return {
            message: 'Switched to vendor successfully',
            accessToken,
            role: 'vendor',

        };
    }





    // -------------------- Profile --------------------
    @Get('profile')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @HttpCode(200)
    @Roles('user', 'vendor')
    async getMyProfile(
        @Req() req: any,
        @CurrentUser() { authId }: AuthUser,
    ) {
        if (!authId) throw new UnauthorizedException('Unauthorized');
        // `req.user.userId` comes from JwtAuthGuard
        return this.authService.getMyProfile(authId);
    }

    // -------------------- Session --------------------
    @UseGuards(OptionalAuthGuard)
    @Get('session')
    async getSession(@Req() req: any) {
        const userPayload = req.user as {
            userId?: string;
            vendorId?: string;
            roles?: string[];
            activeRole?: string;
            currentRole?: string;
        };

        if (!userPayload) return { message: 'No active session' };

        const currentRole = userPayload.activeRole || userPayload.currentRole || userPayload.roles?.[0] || 'user'; // ✅ guaranteed fallback
        const sessionData = await this.authService.getSession({
            role: currentRole,
            userId: userPayload.userId,
            vendorId: userPayload.vendorId,
        });

        return {
            message: 'Session active',
            [currentRole]: sessionData,
            role: currentRole,
        };
    }

    // -------------------- Refresh Token --------------------
    // -------------------- Refresh Token --------------------
    @Post('refresh')
    @HttpCode(200)
    async refreshToken(
        @Body('refreshToken') refreshToken: string,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ) {
        if (!refreshToken) throw new UnauthorizedException('No refresh token provided');

        const tokens = await this.authService.refreshToken(refreshToken, req);

        // Determine frontend origin for cookie security settings
        const origin = req.headers.origin as string;
        const isLocal = origin?.includes('localhost');

        // Set refresh token in secure HTTP-only cookie
        res.cookie('refresh_token', tokens.refreshToken, {
            httpOnly: true,
            secure: !isLocal,                 // true for HTTPS, false for localhost
            sameSite: isLocal ? 'lax' : 'none', // lax for localhost, none for cross-domain HTTPS
            path: '/',                         // cookie valid across all routes
            maxAge: 7 * 24 * 60 * 60 * 1000,   // 7 days
        });

        // Return only the access token in the response
        return {
            accessToken: tokens.accessToken,
        };
    }


    // -------------------- Logout --------------------
    @Post('logout')
    @HttpCode(200)
    async logout(
        @Body('refreshToken') refreshToken: string,
        @Query('all_devices') allDevices?: boolean
    ) {
        if (!refreshToken) return { message: 'Already logged out' };

        await this.authService.logout(refreshToken, allDevices);
        return { message: allDevices ? 'Logged out from all devices' : 'Logged out successfully' };
    }


    // -------------------- Verify Mobile OTP --------------------
    @Post('verify-mobile-otp')
    @HttpCode(202)
    async verifyMobileOtp(
        @Body() verifyOtpDto: VerifyOtpDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ) {
        return this.authService.verifyMobileOtp(verifyOtpDto, req, res);
    }

    // -------------------- Resend Mobile OTP --------------------
    @Post('resend-mobile-otp')
    @HttpCode(200)
    @ApiOperation({ summary: 'Resend OTP to mobile number' })
    @ApiResponse({ status: 200, description: 'OTP resent successfully' })
    @ApiResponse({ status: 404, description: 'No pending registration found' })
    async resendMobileOtp(@Body() resendOtpDto: ResendOtpDto) {
        return this.authService.resendMobileOtp(resendOtpDto);
    }

}
