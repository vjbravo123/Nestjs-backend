import {
    IsString,
    IsOptional,
    IsEnum,
    IsNumber,
    Min,
    Matches,
    IsArray,
    ValidateNested,
    IsObject,
    IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';
import { IsValidObjectId, TransformToObjectId } from 'src/common/validators/is-valid-objectid.validator';

/* ========================================
 * NESTED DTOs FOR ORDER UPDATE
 * ======================================== */

export class UpdateTierDto {
    @IsOptional()
    @IsValidObjectId({ message: 'Tier ID must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    tierId?: Types.ObjectId;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    features?: string[];
}

export class UpdateAddonTierDto {
    @IsOptional()
    @IsValidObjectId({ message: 'Tier ID must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    tierId?: Types.ObjectId;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    features?: string[];
}

export class UpdateAddonDto {
    @IsOptional()
    @IsValidObjectId({ message: 'Addon ID must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    addOnId?: Types.ObjectId;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => UpdateAddonTierDto)
    selectedTier?: UpdateAddonTierDto;

    @IsOptional()
    @IsValidObjectId({ message: 'Addon Vendor ID must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    addOnVendorId?: Types.ObjectId;
}

export class UpdateEventDto {
    @IsOptional()
    @IsValidObjectId({ message: 'Event ID must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    eventId?: Types.ObjectId;

    @IsOptional()
    @IsString()
    eventTitle?: string;

    @IsOptional()
    @IsEnum(['BirthdayEvent', 'ExperientialEvent', 'AddOn'])
    eventCategory?: string;
}

export class UpdateAddressDetailsDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    street?: string;

    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;

    @IsOptional()
    @IsString()
    landMark?: string;

    @IsOptional()
    @IsNumber()
    mobile?: number;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    state?: string;

    @IsOptional()
    @IsNumber()
    pincode?: number;

    @IsOptional()
    @IsEnum(['home', 'office', 'other'])
    addressType?: string;

    @IsOptional()
    @IsString()
    companyName?: string;

    @IsOptional()
    @IsString()
    gstin?: string;
}

/* ========================================
 * MAIN UPDATE ORDER DTO
 * ======================================== */

export class UpdateOrderDto {
    // Order status
    @IsOptional()
    @IsEnum([
        'pending',
        'payment_failed',
        'paid',
        'processing',
        'confirmed',
        'completed',
        'cancelled',
        'refunded',
    ])
    status?: string;

    // Order status (custom field)
    @IsOptional()
    @IsString()
    orderStatus?: string;

    // Vendor assignment
    @IsOptional()
    @IsValidObjectId({ message: 'Vendor ID must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    vendorId?: Types.ObjectId;

    // Event details
    @IsOptional()
    @ValidateNested()
    @Type(() => UpdateEventDto)
    event?: UpdateEventDto;

    // Selected tier
    @IsOptional()
    @ValidateNested()
    @Type(() => UpdateTierDto)
    selectedTier?: UpdateTierDto;

    // Addons
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAddonDto)
    addons?: UpdateAddonDto[];

    // Date and time
    @IsOptional()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'eventDate must be in format yyyy-mm-dd',
    })
    eventDate?: string;

    @IsOptional()
    @IsString()
    eventTime?: string;

    // Address
    @IsOptional()
    @ValidateNested()
    @Type(() => UpdateAddressDetailsDto)
    addressDetails?: UpdateAddressDetailsDto;

    @IsOptional()
    @IsValidObjectId({ message: 'Address ID must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    addressId?: Types.ObjectId;

    // Pricing
    @IsOptional()
    @IsNumber()
    @Min(0)
    baseAmount?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    addonsAmount?: number;

    // @IsOptional()
    // @IsNumber()
    // @Min(0)
    // subtotal?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    discount?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    totalAmount?: number;
}
