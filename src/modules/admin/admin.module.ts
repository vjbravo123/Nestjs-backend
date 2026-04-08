import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Admin, AdminSchema } from './admin.schema';
import { Token, TokenSchema } from '../token/token.schema';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TokenService } from '../token/token.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { TokenModule } from '../token/token.module';
import { User, UserSchema } from '../users/users.schema';
import { ExperientialEvent, ExperientialEventSchema } from '../experientialevent/experientialevent.schema';
import { BirthdayEvent, BirthdayEventSchema } from '../birthdayevent/birthdayevent.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Admin.name, schema: AdminSchema }]),
        MongooseModule.forFeature([{ name: Token.name, schema: TokenSchema }]),
         MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },          
            { name: ExperientialEvent.name, schema: ExperientialEventSchema },
            { name: BirthdayEvent.name, schema: BirthdayEventSchema },
    ]),
        PassportModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'supersecret',
            signOptions: { expiresIn: '15m' }, // 15 minutes for admin access token
        }),
        ThrottlerModule,
        TokenModule,
    ],
    providers: [AdminService, TokenService],
    controllers: [AdminController],
    exports: [AdminService],
})
export class AdminModule { }