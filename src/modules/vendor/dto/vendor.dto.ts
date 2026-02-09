import {
    IsEmail,
    IsString,
    IsNotEmpty,
    MinLength,
    IsNumber,
    IsBoolean,
    IsOptional,
    IsArray,
    IsIn,
    IsMongoId,
    IsDefined,
    ArrayNotEmpty,
    IsUrl,
    ValidateNested,
} from 'class-validator';
import { Types } from 'mongoose'
import { Type } from 'class-transformer';
import { IsValidObjectId, TransformToObjectId } from 'src/common/validators/is-valid-objectid.validator';




export class SocialMediaLinkDto {
    @IsString()
    @IsIn(['instagram', 'facebook', 'linkedin', 'youtube'])
    platform: 'instagram' | 'facebook' | 'linkedin' | 'youtube';

    @IsUrl()
    url: string;
}

export class CreateVendorDtoStep2 {


    @IsString()
    @IsNotEmpty()
    businessName: string;

    @IsString()
    @IsNotEmpty()
    businessType: string;

    @IsString()
    @IsNotEmpty()

    @IsOptional()
    subBusinessType?: string;

    @IsString()
    experience: string;

    // @IsMongoId({ message: 'state must be a valid ObjectId' })
    // state: Types.ObjectId;

    @IsString()
    state: string;

    @IsString()
    city: string;

    @IsString()
    zip: string;

    @IsString()
    businessAddress: string;

    @IsString()
    businessDescription: string;

    @IsBoolean()
    @IsOptional()
    isBusinessInfo: boolean;

    @IsOptional()
    @IsIn(['draft', 'in_progress', 'complete'])
    registrationStatus?: string;

    @IsOptional()
    @IsString()
    gstin?: string;

    @IsOptional()
    @IsArray()
    // Values are assigned as S3 URL strings after file upload in controller
    displayImages?: any[];

    @IsOptional()
    @IsUrl()
    websiteUrl?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SocialMediaLinkDto)
    socialMediaLinks?: SocialMediaLinkDto[];
}

export class CreateVendorDtoStep3 {


    @IsArray()
    @ArrayNotEmpty()
    @IsValidObjectId({
        each: true,
        message: 'Each category id must be a valid MongoDB ObjectId',
    })
    @TransformToObjectId()
    servicesOffered: Types.ObjectId[];


    @IsDefined({ message: 'AgreeToTerms is required' })
    @IsBoolean()
    agreeToTerms: boolean;

    @IsDefined({ message: 'Consent is required' })
    @IsBoolean()
    consent: boolean;

    @IsOptional()
    @IsIn(['draft', 'in_progress', 'complete'])
    registrationStatus?: string;
}

// Profile Update DTOs
export class UpdateVendorProfileDto {
    @IsOptional()
    @IsString()
    businessName?: string;

    @IsOptional()
    @IsString()
    businessType?: string;

    @IsOptional()
    @IsString()
    subBusinessType?: string;

    @IsOptional()
    @IsString()
    experience?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    state?: string;

    @IsOptional()
    @IsString()
    zip?: string;

    @IsOptional()
    @IsString()
    businessAddress?: string;

    @IsOptional()
    @IsString()
    businessDescription?: string;

    @IsOptional()
    @IsString()
    gstin?: string;

    @IsOptional()
    @IsArray()
    displayImages?: string[];

    @IsOptional()
    @IsString()
    websiteUrl?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SocialMediaLinkDto)
    socialMediaLinks?: SocialMediaLinkDto[];

    @IsOptional()
    @IsArray()
    servicesOffered?: string[];
}

export class AdminApprovalDto {
    @IsIn(['approved', 'rejected'])
    action: 'approved' | 'rejected';

    @IsOptional()
    @IsString()
    reason?: string;

    @IsOptional()
    @IsString()
    businessName?: string;

    @IsOptional()
    @IsString()
    businessType?: string;

    @IsOptional()
    @IsString()
    subBusinessType?: string;

    @IsOptional()
    @IsString()
    experience?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    state?: string;

    @IsOptional()
    @IsString()
    zip?: string;

    @IsOptional()
    @IsString()
    businessAddress?: string;

    @IsOptional()
    @IsString()
    businessDescription?: string;

    @IsOptional()
    @IsString()
    gstin?: string;

    @IsOptional()
    @IsArray()
    displayImages?: string[];

    @IsOptional()
    @IsString()
    websiteUrl?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SocialMediaLinkDto)
    socialMediaLinks?: SocialMediaLinkDto[];

    @IsOptional()
    @IsArray()
    servicesOffered?: string[];
}