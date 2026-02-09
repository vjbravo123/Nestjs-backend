
import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  HttpStatus,
  NotFoundException,
  HttpException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request, Response } from 'express';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateVendorDtoStep1 } from './dto/create-vendor.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { User, UserDocument } from '../users/users.schema';
import { Auth, AuthDocument } from './auth.schema';
import { Vendor, VendorDocument } from '../vendor/vendor.schema';
import { TokenService } from '../../services/token.service';
import { UsersService } from '../users/users.service';
import { Types } from 'mongoose';
import { VendorService } from '../vendor/vendor.service';
import { UtilityService } from '../../services/utility.service';
import { Msg91Service } from 'src/services/sms.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { generateSecureOtp } from '../../common/utils/otp.util'
import logger from '../../common/utils/logger';
interface DeviceInfo {
  userAgent: string;
  ip: string;
}

@Injectable()
export class AuthService {
  private readonly logger = logger;
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Vendor.name) private vendorModel: Model<VendorDocument>,
    @InjectModel(Auth.name) private authModel: Model<AuthDocument>,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly eventEmitter: EventEmitter2, // ✅ CORRECT
    private readonly tokenService: TokenService,
    private readonly msg91Service: Msg91Service,
    private readonly usersService: UsersService,
    private readonly vendorService: VendorService,
    private readonly utilityService: UtilityService,
  ) { }

  // -------------------- User Registration --------------------
  async register(createUserDto: CreateUserDto): Promise<{ message: string; mobile: number }> {
    // 1️⃣ Hash the password before storing
    createUserDto.password = await this.utilityService.hashPassword(createUserDto.password);

    const mobile = createUserDto.mobile.toString();

    // 2️⃣ Store user data in Redis temporarily (10 minutes TTL)
    const redisKey = `pendingUser:${mobile}`;
    await this.redisClient.set(redisKey, JSON.stringify(createUserDto), 'EX', 600);

    // 3️⃣ Send OTP to the mobile number
    await this.sendOtpToMobile(Number(mobile));

    // 4️⃣ Return response
    return {
      message: 'OTP sent to your mobile. Please verify to complete registration.',
      mobile: createUserDto.mobile,
    };
  }


  // -------------------- Vendor Registration --------------------
  async registerVendor(
    createVendorDto: CreateVendorDtoStep1,
  ): Promise<{ message: string; mobile: number }> {

    // 1️⃣ Normalize email and hash password
    createVendorDto.email = createVendorDto.email.trim().toLowerCase();
    createVendorDto.password = await this.utilityService.hashPassword(
      createVendorDto.password,
    );

    // 2️⃣ Check if vendor email already exists
    // const existingVendor = await this.vendorService.getVendorByEmail(
    //   createVendorDto.email,
    // );

    // if (existingVendor) {
    //   throw new HttpException(
    //     {
    //       statusCode: HttpStatus.CONFLICT,
    //       message: 'Email already in use',
    //       status: 'USER_ALREADY_EXISTS',
    //     },
    //     HttpStatus.CONFLICT,
    //   );
    // }

    const mobile = createVendorDto.mobile.toString();

    // 3️⃣ Store vendor data temporarily in Redis (10 minutes)
    const redisKey = `pendingVendor:${mobile}`;
    await this.redisClient.set(redisKey, JSON.stringify(createVendorDto), 'EX', 600);

    // 4️⃣ Send OTP using your existing OTP sender
    await this.sendOtpToMobile(Number(mobile)); // generates + sends + stores OTP in Redis

    // 5️⃣ Return response
    return {
      message: 'OTP sent to your mobile. Please verify to complete vendor registration.',
      mobile: createVendorDto.mobile,
    };
  }



  async forceRegisterVendor(mobile: number): Promise<{ message: string; mobile: number }> {
    // 1️⃣ Fetch user by mobile
    const existingUser = await this.usersService.findUserByMobile(mobile);
    if (!existingUser) {
      throw new NotFoundException('No user found with this mobile number');
    }

    // 2️⃣ Prepare vendor data
    const vendorData = {
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      mobile: existingUser.mobile,
      email: existingUser.email,
      password: existingUser.password, // already hashed
      userId: existingUser._id,        // link to user
    };

    // 3️⃣ Store in Redis temporarily (10 minutes TTL)
    await this.redisClient.set(
      `pendingVendor:${mobile}`,
      JSON.stringify(vendorData),
      'EX',
      600,
    );

    // 4️⃣ Send OTP using your existing OTP sender
    await this.sendOtpToMobile(Number(mobile)); // generates + sends + stores OTP in Redis

    // 5️⃣ Return response
    return {
      message: 'OTP sent to your mobile. Please verify to complete vendor registration.',
      mobile,
    };
  }
  // -------------------- Login (user/vendor combined) --------------------
  async login(
    loginDto: LoginDto,
    req: Request
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    role: 'user' | 'vendor';
    publicData: Record<string, any>;
  }> {
    const { mobile, password } = loginDto;

    // 1️⃣ Find both user & vendor in parallel
    const [user, vendor] = await Promise.all([
      this.usersService.findUserByMobile(mobile),
      this.vendorService.findVendorByMobile(mobile),
    ]);

    let entity: UserDocument | VendorDocument | null = null;
    let role: 'user' | 'vendor';

    // 2️⃣ Prioritize vendor if exists
    if (vendor) {
      const isValid = await this.utilityService.comparePassword(password, vendor.password);
      if (!isValid) throw new UnauthorizedException('Invalid credentials');
      entity = vendor;
      role = 'vendor';
    } else if (user) {
      const isValid = await this.utilityService.comparePassword(password, user.password);
      if (!isValid) throw new UnauthorizedException('Invalid credentials');
      entity = user;
      role = 'user';
    } else {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3️⃣ Check mobile verification & active status
    if (!entity.isMobileVerify) {
      throw new HttpException('Mobile number not verified', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (!entity.isActive) {
      throw new HttpException('Your account is inactive. Contact admin', HttpStatus.FORBIDDEN);
    }

    // 4️⃣ Find or create Auth record
    let auth = await this.authModel.findOne({ mobile });

    console.log("auth record", auth);
    if (!auth) {
      auth = await this.authModel.create({
        mobile,
        roles: [role],
        [`${role}Id`]: entity._id,
        currentRole: role,
        isMobileVerified: true,
      });
    } else {
      if (!auth.roles.includes(role)) auth.roles.push(role);
      // auth[`${role}Id`] = entity._id as Types.ObjectId;
      auth?.userId,
        auth?.vendorId,

        auth.currentRole = role;
      auth.isMobileVerified = true;
      await auth.save();
    }

    // 5️⃣ Generate device info
    const device = this.getDeviceInfo(req);

    // 6️⃣ Prepare payload for tokens
    const payload = {
      authId: auth.id.toString(),
      roles: auth.roles,
      userId: auth.userId?.toString(),
      vendorId: auth.vendorId?.toString(),
      currentRole: auth.currentRole
    };

    // 7️⃣ Generate JWT tokens
    const tokens = await this.tokenService.generateTokens(payload, device);

    // 8️⃣ Prepare role-based public data
    const publicData =
      role === 'user'
        ? {
          firstName: entity.firstName,
          lastName: entity.lastName,
          email: entity.email,
          mobile: entity.mobile,
          isMobileVerify: entity.isMobileVerify,
          isEmailVerify: entity.isEmailVerify,
        }
        : {
          firstName: entity.firstName,
          lastName: entity.lastName,
          email: entity.email,
          mobile: entity.mobile,
          userId: (entity as any).userId,
          isMobileVerify: entity.isMobileVerify,
          isEmailVerify: entity.isEmailVerify,
          registrationStatus: (entity as any).registrationStatus || 'pending',
          isVerified: (entity as any).isVerified || false,
          profileUpdateStatus: (entity as any).profileUpdateStatus || 'none',
        };

    // Emit login event for notifications
    const userId = role === 'user'
      ? String((entity as UserDocument)._id)
      : (entity as VendorDocument).userId?.toString();

    if (userId) {
      this.eventEmitter.emit('user.logged_in', {
        userId,
        email: entity.email,
        name: `${entity.firstName} ${entity.lastName}`.trim(),
        role,
        mobile: entity.mobile,
      });
    }

    // 9️⃣ Return final response
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      role,
      publicData,
    };
  }
  // -------------------- Get Session --------------------
  async getSession(userPayload: { role: string; userId?: string; vendorId?: string }) {
    const { role, userId, vendorId } = userPayload;

    let entity: any;

    // Pick correct service based on active role
    if (role === 'vendor' && vendorId) {
      entity = await this.vendorService.findVendorById(vendorId);
    } else if (role === 'user' && userId) {
      entity = await this.usersService.findUserById(userId);
    } else {
      throw new NotFoundException('Invalid role or missing ID');
    }

    if (!entity) throw new NotFoundException(`${role} not found`);

    return {
      firstName: entity.firstName,
      lastName: entity.lastName,
      email: entity.email,
      mobile: entity.mobile,
      role,
      isActive: entity.isActive,
      isVerified: entity.isVerified,
      isMobileVerify: entity.isMobileVerify,
      isEmailVerify: entity.isEmailVerify,
    };
  }


  // -------------------- Profile --------------------
  async getMyProfile(authId: Types.ObjectId) {
    const profile = await this.authModel
      .findById(authId)
      .populate({
        path: "userId",
        select: "firstName lastName email mobile",
      })
      .populate({
        path: "vendorId",
        select: `
        firstName
        lastName
        email
        mobile
        isVerified
        isVendorApprove
        registrationStatus
        businessName
        profileUpdateStatus
        isEmailVerify
        pendingChanges.businessName
      `,
      })
      .lean();

    if (!profile) {
      throw new NotFoundException("Profile not found");
    }

    /** ------------------------------------------------
     * RESOLVE BUSINESS NAME + CLEAN RESPONSE
     * ------------------------------------------------ */
    if (profile.currentRole === "vendor" && profile.vendorId) {
      const vendor: any = profile.vendorId;

      const resolvedBusinessName =
        vendor.isVerified === false
          ? vendor?.pendingChanges?.businessName || vendor.businessName
          : vendor.businessName;

      // 🔥 Remove pendingChanges from response
      const { pendingChanges, ...vendorWithoutPending } = vendor;

      profile.vendorId = {
        ...vendorWithoutPending,
        businessName: resolvedBusinessName,
      };
    }

    /** ------------------------------------------------
     * ROLE-BASED RESPONSE
     * ------------------------------------------------ */
    return {
      ...profile,
      userId: profile.currentRole === "user" ? profile.userId : null,
      vendorId: profile.currentRole === "vendor" ? profile.vendorId : null,
    };
  }


  // -------------------- Refresh Token --------------------
  // -------------------- Refresh Token --------------------
  async refreshToken(refreshToken: string, req: Request) {
    // 1️⃣ Verify the refresh token
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);

    // 2️⃣ Find user by payload.sub
    const user = await this.usersService.findUserById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');

    // 3️⃣ Validate that the refresh token is part of active sessions
    await this.tokenService.validateSession(user, refreshToken, payload.tokenVersion);

    // 4️⃣ Generate new access & refresh tokens
    const device = this.getDeviceInfo(req);
    return await this.tokenService.generateTokens(user, device);
  }

  // -------------------- Logout --------------------
  async logout(refreshToken: string, allDevices = false) {
    // 1️⃣ Verify refresh token
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);

    // 2️⃣ Invalidate sessions (all devices or single)
    await this.tokenService.invalidateSessions(payload.sub, allDevices);
  }


  // -------------------- Logout --------------------

  // -------------------- Verify Mobile OTP --------------------
  async verifyMobileOtp(
    verifyOtpDto: VerifyOtpDto,
    req: Request,
    res: Response
  ) {
    const { mobile, otp, role } = verifyOtpDto;
    const currentRole = role;
    const redisOtpKey = `OTP:${mobile}`;
    const redisPendingKey =
      role === 'vendor' ? `pendingVendor:${mobile}` : `pendingUser:${mobile}`;
    console.log("redisPendingKey", redisPendingKey);
    console.log("redisOtpKey", redisOtpKey);
    // 1️⃣ Validate OTP
    const storedOtp = await this.redisClient.get(redisOtpKey);
    if (!storedOtp) {
      // Check if pending registration exists to distinguish between expired and not sent
      const pendingData = await this.redisClient.get(redisPendingKey);
      if (!pendingData) {
        // No pending registration found - OTP was never sent
        throw new NotFoundException('OTP not found. Please register again.');
      } else {
        // Pending registration exists but OTP expired
        throw new HttpException(
          'OTP has expired. Please request a new OTP.',
          HttpStatus.GONE,
        );
      }
    }

    // Convert both to strings for comparison (Redis returns string, otp might be number)
    const storedOtpStr = String(storedOtp).trim();
    const otpStr = String(otp).trim();

    console.log("OTP Comparison - stored:", storedOtpStr, "received:", otpStr, "storedType:", typeof storedOtp, "receivedType:", typeof otp);

    if (storedOtpStr !== otpStr) {
      throw new UnprocessableEntityException('Invalid OTP');
    }

    let user: UserDocument | null = null;
    let vendor: VendorDocument | null = null;

    // 2️⃣ Fetch existing records
    user = await this.usersService.findUserByMobile(mobile);
    vendor = await this.vendorService.findVendorByMobile(mobile);

    // 3️⃣ Create entities if not exist
    if (role === 'vendor' && !vendor) {
      const pendingVendorData = await this.redisClient.get(redisPendingKey);
      if (!pendingVendorData) {
        throw new NotFoundException('Vendor registration data not found');
      }

      const vendorData = JSON.parse(pendingVendorData);

      // 🔹 Create USER first (mandatory)
      if (!user) {
        user = await this.usersService.createUser({
          firstName: vendorData.firstName,
          lastName: vendorData.lastName,
          email: vendorData.email,
          mobile: vendorData.mobile,
          password: vendorData.password,
          isMobileVerify: true,
        });
      }

      // 🔹 Create VENDOR and link userId
      vendor = await this.vendorService.createVendor({
        ...vendorData,
        userId: user._id,
        isMobileVerify: true,
      });
    }

    if (role === 'user' && !user) {
      const pendingUserData = await this.redisClient.get(redisPendingKey);
      if (!pendingUserData) {
        throw new NotFoundException('User registration data not found');
      }




      user = await this.usersService.createUser(JSON.parse(pendingUserData));
    }

    // 4️⃣ Link Auth record (USER + VENDOR support)
    // When vendor is created, add both 'user' and 'vendor' roles
    const rolesToAdd: ('user' | 'vendor')[] = [];
    if (user) rolesToAdd.push('user');
    if (vendor) rolesToAdd.push('vendor');

    // Link auth with primary role and IDs
    let auth = await this.linkAuthRecord({
      mobile,
      role: rolesToAdd[0] || role,
      userId: user?._id ? (user._id as Types.ObjectId) : undefined,
      vendorId: vendor?._id ? (vendor._id as Types.ObjectId) : undefined,
      currentRole
    });
    console.log("auth update the role and id ", auth)
    // Ensure all roles are added (add remaining roles if any)
    if (rolesToAdd.length > 1) {
      const rolesToAddSet = new Set(rolesToAdd);
      const existingRolesSet = new Set(auth.roles || []);

      // Add any missing roles
      for (const roleToAdd of rolesToAddSet) {
        if (!existingRolesSet.has(roleToAdd)) {
          await this.authModel.updateOne(
            { _id: auth._id },
            { $addToSet: { roles: roleToAdd } }
          );
        }
      }

      // Refresh auth to get updated roles
      const refreshedAuth = await this.authModel.findById(auth._id);
      if (!refreshedAuth) {
        throw new Error('Failed to refresh Auth record');
      }
      auth = refreshedAuth as AuthDocument;
    }

    // 5️⃣ Mark verified
    if (user) {
      user.isMobileVerify = true;
      await user.save();

    }
    if (vendor) {
      vendor.isMobileVerify = true;
      await vendor.save();
    }

    if (role == 'user') {
      console.log("register event trigger")
      this.eventEmitter.emit('user.registered', {
        userId: auth.userId,   // ✅ REQUIRED
        role: 'user',                     // ✅ REQUIRED ('user' or 'vendor')
        email: user?.email,
        name: user?.firstName.toUpperCase(),
        mobile: user?.mobile,
      });
    } else {
      console.log("register event trigger")
      this.eventEmitter.emit('vendor.registered', {
        partnerName: vendor?.firstName.toUpperCase(),
        partnerEmail: vendor?.email,
        partnerPhone: vendor?.mobile,
        registerDate: new Date(),
      });
    }
    // 6️⃣ Clear Redis
    await this.redisClient.del(redisOtpKey);
    await this.redisClient.del(redisPendingKey);

    // 7️⃣ Generate Tokens
    const device = this.getDeviceInfo(req);
    const payload = {
      authId: auth.id?.toString() || auth._id?.toString(),
      roles: currentRole,
      userId: auth.userId?.toString(),
      vendorId: auth.vendorId?.toString(),
      currentRole: role,
    };
    console.log("payload for token generation", payload);
    const tokens = await this.tokenService.generateTokens(payload, device);

    // 8️⃣ Set Refresh Token Cookie
    const origin = req.headers.origin as string;
    const isLocal = origin?.includes('localhost');

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: !isLocal,
      sameSite: isLocal ? 'lax' : 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 9️⃣ Final Response
    return {
      message: 'OTP verified successfully',
      accessToken: tokens.accessToken,
      role,
      user: user && {
        id: user._id,
        firstName: user.firstName,
        email: user.email,
        mobile: user.mobile,
      },
      vendor: vendor && {
        id: vendor._id,
        businessName: vendor.businessName,
        mobile: vendor.mobile,
      },
    };
  }

  // -------------------- Resend Mobile OTP --------------------
  async resendMobileOtp(resendOtpDto: { mobile: number; role: 'user' | 'vendor' }): Promise<{ message: string; mobile: number }> {
    const { mobile, role } = resendOtpDto;

    // 1️⃣ Check if pending registration data exists in Redis
    const redisPendingKey =
      role === 'vendor' ? `pendingVendor:${mobile}` : `pendingUser:${mobile}`;

    const pendingData = await this.redisClient.get(redisPendingKey);
    if (!pendingData) {
      throw new NotFoundException('No pending registration found. Please register again.');
    }

    // 2️⃣ Send new OTP
    await this.sendOtpToMobile(Number(mobile));

    // 3️⃣ Return response
    return {
      message: 'OTP resent successfully to your mobile.',
      mobile,
    };
  }

  async linkAuthRecord(params: {
    mobile: number;
    role: 'user' | 'vendor';
    refId?: string | Types.ObjectId;
    userId?: string | Types.ObjectId;
    vendorId?: string | Types.ObjectId;
    currentRole: 'user' | 'vendor';
  }): Promise<AuthDocument> {

    const { mobile, role, refId, userId, vendorId, currentRole } = params;

    let auth = await this.authModel.findOne({ mobile });

    if (!auth) {
      const createData: any = {
        mobile,
        roles: [role],
        currentRole,              // ✅ now valid
        isMobileVerified: true,
      };

      if (userId) createData.userId = userId;
      if (vendorId) createData.vendorId = vendorId;
      if (refId && !userId && !vendorId) {
        createData[`${role}Id`] = refId;
      }

      auth = await this.authModel.create(createData);
    } else {
      const updateOps: any = {
        $addToSet: { roles: role },
        $set: {
          isMobileVerified: true,
          currentRole,           // ✅ also safe here
        },
      };

      if (userId) updateOps.$set.userId = userId;
      if (vendorId) updateOps.$set.vendorId = vendorId;
      if (refId && !userId && !vendorId) {
        updateOps.$set[`${role}Id`] = refId;
      }

      await this.authModel.updateOne({ _id: auth._id }, updateOps);
      auth = await this.authModel.findById(auth._id);
    }

    if (!auth) throw new Error('Failed to create or update Auth record');
    return auth;
  }




  // -------------------- Vendor Login with OTP --------------------
  async vendorLogin(loginDto: LoginDto, req: Request, res: Response) {
    const { mobile, password } = loginDto;
    const vendor = await this.vendorService.findVendorByMobile(mobile);

    if (!vendor) {
      throw new HttpException(
        { statusCode: HttpStatus.UNAUTHORIZED, message: 'Invalid email or password', loginType: 'vendor' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isPasswordValid = await this.utilityService.comparePassword(password, vendor.password);
    if (!isPasswordValid) throw new UnprocessableEntityException('Invalid password');

    if (!vendor.isMobileVerify) {
      const otp = await this.sendVendorLoginOtp(vendor);
      const { password: _p, ...details } = vendor.toObject();
      return res.json({
        message: 'OTP sent to your registered mobile. Please verify to continue.',
        vendor: details,
        type: 'vendor',
        requireOtp: true,
      });
    }

    const device = this.getDeviceInfo(req);
    const vendorPayload: any = {
      _id: vendor._id,
      email: vendor.email,
      tokenVersion: vendor.tokenVersion,
      role: vendor.role,
      activeSessions: [],
    };
    const tokens = await this.tokenService.generateTokens(vendorPayload, device);

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { password: _p, ...details } = vendor.toObject();
    return res.json({
      message: 'Login successful',
      accessToken: tokens.accessToken,
      vendor: details,
      type: 'vendor',
    });
  }

  // async loginWithVendorToken(vendorToken: string, req: Request) {
  //   // 1️⃣ Verify vendor token
  //   let vendorPayload;
  //   try {
  //     vendorPayload = await this.tokenService.verifyAccessToken(vendorToken);
  //   } catch (err) {
  //     this.logger.error(`Vendor token verification failed: ${err.message}`);
  //     throw new UnauthorizedException('Invalid vendor token (JWT verification failed)');
  //   }

  //   const vendorId = vendorPayload.vendorId || vendorPayload.sub;
  //   if (!vendorId) {
  //     this.logger.error('Missing vendorId in token payload', vendorPayload);
  //     throw new UnauthorizedException('Invalid vendor token (no vendor ID)');
  //   }

  //   // 2️⃣ Find vendor in DB
  //   const vendor = await this.vendorService.findVendorById(vendorId);
  //   if (!vendor) {
  //     this.logger.error(`Vendor not found for ID: ${vendorId}`);
  //     throw new UnauthorizedException('Vendor not found');
  //   }

  //   // 3️⃣ Find or create corresponding user
  //   let user = await this.usersService.findUserByMobile(vendor.mobile);
  //   if (!user) {
  //     user = await this.usersService.registerUserFromVendorToken(vendor.mobile, vendorPayload);
  //   }

  //   // 4️⃣ Find or create/update Auth record
  //   let auth = await this.authModel.findOne({ mobile: vendor.mobile });
  //   if (!auth) {
  //     auth = await this.authModel.create({
  //       mobile: vendor.mobile,
  //       roles: ['user', 'vendor'],
  //       userId: user._id,
  //       vendorId: vendor._id,
  //       currentRole: 'user',
  //       isMobileVerified: true,
  //     });
  //   } else {
  //     if (!auth.roles.includes('user')) auth.roles.push('user');
  //     auth.userId = user._id as Types.ObjectId;
  //     auth.currentRole = 'user';
  //     auth.isMobileVerified = true;
  //     await auth.save();
  //   }

  //   // 5️⃣ Prepare payload for tokens
  //   const payload = {
  //     authId: auth.id?.toString(),
  //     roles: auth.roles,
  //     userId: auth.userId?.toString(),
  //     vendorId: auth.vendorId?.toString(),
  //     currentRole: auth.currentRole
  //   };

  //   // 6️⃣ Generate tokens
  //   const device = this.getDeviceInfo(req);
  //   const tokens = await this.tokenService.generateTokens(payload, device);

  //   // 7️⃣ Return sanitized user data
  //   const { password, ...userDetails } = user.toObject();
  //   return {
  //     message: 'User login successful via vendor token',
  //     accessToken: tokens.accessToken,
  //     refreshToken: tokens.refreshToken,
  //     role: 'user',
  //     user: {
  //       firstName: userDetails.firstName,
  //       lastName: userDetails.lastName,
  //       email: userDetails.email,
  //       mobile: userDetails.mobile,
  //       role: userDetails.role,
  //       isActive: userDetails.isActive,
  //       isMobileVerify: userDetails.isMobileVerify,
  //       isEmailVerify: userDetails.isEmailVerify,
  //       // Add more fields if needed
  //     },
  //   }

  // }


  async switchToUser(payloadData: any, req: Request) {
    const logger = console;
    console.log("payloadData in switchToUser", payloadData);
    logger.info(`Auth ${payloadData.authId} requested to switch to user`);

    // 1️⃣ Find auth by authId
    const auth = await this.authModel.findOne({ _id: payloadData.authId });
    if (!auth) {
      throw new HttpException(
        { statusCode: HttpStatus.NOT_FOUND, message: 'Auth account not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    console.log("auth in switchToUser", auth);

    // 2️⃣ Check if user role exists, if not create user
    if (!auth.roles.includes('user')) {
      // Create new user in users module
      const getVendor = await this.vendorService.findVendorByMobile(auth.mobile);
      console.log("getVendor in switchToUser", getVendor);

      if (!getVendor) {
        throw new HttpException(
          { statusCode: HttpStatus.NOT_FOUND, message: 'Vendor not found' },
          HttpStatus.NOT_FOUND,
        );
      }

      const newUser = await this.usersService.createUser({
        mobile: getVendor.mobile,
        firstName: getVendor.firstName || '',
        lastName: getVendor.lastName || '',
        email: getVendor.email || '',
        password: getVendor.password || '',
      });

      // Update auth with userId and add user role
      auth.userId = newUser._id as Types.ObjectId;
      auth.roles.push('user');
      auth.currentRole = 'user';
      await auth.save();
    } else {
      // User role already exists, just switch to user
      auth.currentRole = 'user';
      await auth.save();
    }

    // 3️⃣ Generate new tokens for USER
    const device = this.getDeviceInfo(req);
    const payload = {
      authId: auth.id?.toString(),
      roles: auth.roles,
      userId: auth.userId?.toString(),
      vendorId: auth.vendorId?.toString(),
      currentRole: 'user'
    };
    const { accessToken, refreshToken } = await this.tokenService.generateTokens(payload, device);

    return { accessToken, refreshToken };
  }



  async switchToVendor(payloadData: any, req: Request) {
    const logger = console;
    const vendorId = payloadData.vendorId;

    logger.info(`User ${vendorId} requested to switch to vendor`);

    // 1️⃣ Find the vendor account linked to this user
    const auth = await this.authModel.findOne({ vendorId: vendorId });
    if (!auth) {
      throw new HttpException(
        { statusCode: HttpStatus.NOT_FOUND, message: 'Vendor account not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    // 2️⃣ Generate new tokens for vendor
    const device = this.getDeviceInfo(req);
    const payload = {
      authId: auth.id?.toString(),
      roles: auth.roles,
      userId: auth.userId?.toString(),
      vendorId: auth.vendorId?.toString(),
      currentRole: 'vendor'
    };
    const { accessToken, refreshToken } = await this.tokenService.generateTokens(payload, device);


    auth.currentRole = 'vendor';
    await auth.save();
    // 3️⃣ Prepare vendor response data


    return { accessToken, refreshToken };
  }





  // -------------------- Helper: Get Device Info --------------------

  private getDeviceInfo(req: Request): DeviceInfo {
    const userAgent = req.headers['user-agent'] as string || 'unknown';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return { userAgent, ip };
  }




  // -------------------- Helper: Send Vendor Login OTP --------------------
  private async sendVendorLoginOtp(vendor: VendorDocument) {
    const otp = generateSecureOtp();
    console.log("otp", otp);
    this.logger.info(`OTP ${otp} sent `);
    try {
      await this.msg91Service.sendOtp(vendor.mobile, otp);
      logger.info(`OTP sent to vendor ${vendor.mobile}`);
    } catch (err) {
      throw new HttpException(
        'Failed to send OTP. Please try again later.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return otp;
  }



  private async sendOtpToMobile(mobile: number): Promise<string> {
    const otp = generateSecureOtp();
    console.log("otp", otp);
    this.logger.info(`OTP ${otp} sent to ${mobile}`);
    // 1️⃣ Send OTP via MSG91
    try {
      await this.msg91Service.sendOtp(mobile, otp);
    } catch (err) {
      console.log(err);
      throw new HttpException(
        'Failed to send OTP. Please try again later.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    // 2️⃣ Store in Redis
    const redisKey = `OTP:${mobile}`;
    await this.redisClient.set(redisKey, otp, 'EX', 600);
    console.log("redisKey", redisKey);
    console.log("otp", otp);
    this.logger.info(`OTP ${otp} sent to ${mobile}`);

    return otp;
  }




}
