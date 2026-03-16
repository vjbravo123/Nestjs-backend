// src/auth/dto/create-vendor.dto.ts

import { IsEmail, IsNotEmpty, IsNumber, IsString, MinLength, IsOptional, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
export class CreateVendorDtoStep1 {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsNumber()
    @Type(() => Number)
    @IsNotEmpty()
    mobile: number;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;



    @IsOptional()
    @IsString()
    @IsIn(['user', 'admin', 'vendor'])
    role?: string; // Optional (user/admin/vendor)
}

