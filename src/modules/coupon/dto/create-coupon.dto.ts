import {
    IsString,
    IsEnum,
    IsNumber,
    IsOptional,
    IsDateString,
    IsBoolean,
    Min,
    IsMongoId,
    IsArray,
} from 'class-validator';

export class CreateCouponDto {
    @IsString()
    code: string; // e.g. SAVE10

    @IsEnum(['percentage', 'fixed'])
    discountType: 'percentage' | 'fixed'; // only allow these values

    @IsNumber()
    @Min(1)
    discountValue: number; // e.g. 20% or 500

    @IsOptional()
    @IsNumber()
    @Min(1)
    maxUsage?: number; // total times coupon can be used

    @IsOptional()
    @IsNumber()
    @Min(1)
    maxDiscount?: number; // cap for percentage discount

    @IsOptional()
    @IsNumber()
    @Min(1)
    minimumAmount?: number; // min order value required

    @IsOptional()
    @IsNumber()
    @Min(1)
    userLimit?: number; // times per single user

    @IsDateString()
    expiryDate: string; // ISO string (e.g. "2025-12-31")

    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;

    @IsOptional()
    @IsBoolean()
    isGlobal?: boolean = false; // applies to all events if true

    // ✅ Event restrictions
    @IsOptional()
    @IsArray()
    @IsMongoId({ each: true })
    includeBirthDayEvents?: string[]; // allowed only for these events

    @IsOptional()
    @IsArray()
    @IsMongoId({ each: true })
    excludeBirthDayEvents?: string[]; // not allowed for these events

    // ✅ User restrictions
    @IsOptional()
    @IsArray()
    @IsMongoId({ each: true })
    assignedUsers?: string[]; // only for these users
}
