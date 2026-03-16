// dto/update-user.dto.ts

import {
    IsOptional,
    IsString,
    IsNumber,
    IsBoolean,
    MinLength,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    firstName?: string;

    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    lastName?: string;


    @IsOptional()
    @IsString()
    
    email?: string;



    // @IsOptional()
    // @IsString()
    // profileImage?: string;

    // @IsOptional()
    // @Type(() => Number)
    // @IsNumber()
    // mobile?: number;

    @IsOptional()
    @IsBoolean()
    agreeToTerms?: boolean;
}