import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HttpModule } from '@nestjs/axios';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from '../../services/token.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { VendorModule } from 'src/modules/vendor/vendor.module';
import { UtilityModule } from 'src/services/utility.module';
import { RedisModule } from '../redis/redis.module';
import { User, UserSchema } from '../users/users.schema';
import { Auth, AuthSchema } from './auth.schema';
import { MongooseModule } from '@nestjs/mongoose';
import logger from '../../common/utils/logger';
import { Msg91Service } from 'src/services/sms.service';
@Module({
  imports: [
    HttpModule,
    UsersModule,           // ✅ UsersModule
    VendorModule,          // ✅ VendorModule
    PassportModule,
    RedisModule,           // ✅ RedisModule for REDIS_CLIENT
    UtilityModule,         // ✅ UtilityModule
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([{ name: Auth.name, schema: AuthSchema }]),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy, RolesGuard,Msg91Service],
  exports: [AuthService, TokenService],
})
export class AuthModule {
  constructor() {
    logger.info('AuthModule initialized');
  }
}
