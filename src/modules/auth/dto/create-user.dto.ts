// src/auth/dto/create-user.dto.ts

import { IsEmail, IsBoolean, IsNumber, IsNotEmpty, IsString, MinLength, IsOptional, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
export class CreateUserDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    mobile: number;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;


    @IsBoolean()
    @IsNotEmpty()
    agreeToTerms: boolean;


    @IsOptional()
    @IsString()
    @IsIn(['user', 'admin', 'vendor'])
    role?: string; // Optional (user/admin/vendor)

}
