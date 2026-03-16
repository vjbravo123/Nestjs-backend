import { IsOptional, IsString, IsIn, IsNumber, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminLoginAsDto {
    @IsOptional()
    @IsString()
    userId?: string;

    @IsOptional()
    @IsString()
    vendorId?: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    mobile?: number;

    @IsIn(['user', 'vendor'])
    targetRole: 'user' | 'vendor';
}
