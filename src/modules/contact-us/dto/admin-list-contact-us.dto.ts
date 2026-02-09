import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumberString, IsString, IsEmail } from 'class-validator';

export class AdminListContactUsDto {
    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsNumberString()
    page?: number;

    @ApiPropertyOptional({ example: 20 })
    @IsOptional()
    @IsNumberString()
    limit?: number;

    // 🔍 Filters
    @ApiPropertyOptional({ example: 'Mumbai' })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiPropertyOptional({ example: 'rahul@gmail.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: '9876543210' })
    @IsOptional()
    @IsString()
    mobile?: string;
}
