import {
    IsEmail,
    IsString,
    IsNotEmpty,
    MinLength,
    IsBoolean,
    IsOptional,
    IsArray,
    IsIn,
    IsDefined,
    ArrayNotEmpty,
    IsUrl,
    ValidateNested,
    Matches,
} from 'class-validator';

import { Types } from 'mongoose';
import { Type, Transform } from 'class-transformer';
import {
    IsValidObjectId,
    TransformToObjectId,
} from 'src/common/validators/is-valid-objectid.validator';

/* -------------------------------- SOCIAL LINKS -------------------------------- */


export class SocialMediaLinkDto {
    @IsString()
    @IsIn(['instagram', 'facebook', 'linkedin', 'youtube'])
    platform: 'instagram' | 'facebook' | 'linkedin' | 'youtube';

    @IsUrl()
    url: string;
}


/* -------------------------------- MAIN ADMIN DTO -------------------------------- */

export class CreateVendorByAdminDto {
    /* ---------------- BASIC ---------------- */

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsEmail()
    email: string;

    // FormData → string, so validate as string
    @IsString()
    @Matches(/^[6-9]\d{9}$/, {
        message: 'Mobile must be valid 10 digit Indian number',
    })
    mobile: string;

    @MinLength(6)
    @IsOptional()
    password: string;

    /* ---------------- BUSINESS ---------------- */

    @IsString()
    @IsNotEmpty()
    businessName: string;

    @IsString()
    @IsNotEmpty()
    businessType: string;



    @IsString()
    experience: string;

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

    @IsOptional()
    @IsString()
    gstin?: string;

    /* ---------------- FILES (FROM CONTROLLER) ---------------- */

    @IsOptional()
    @IsArray()
    displayImages?: string[];

    /* ---------------- ONLINE ---------------- */

    @IsOptional()
    @IsUrl()
    websiteUrl?: string;

    /* ---------------- SOCIAL LINKS ---------------- */

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SocialMediaLinkDto)
    socialMediaLinks?: SocialMediaLinkDto[];

    /* ---------------- SERVICES (FormData array) ---------------- */

    @IsArray()
    @IsNotEmpty()
    @ArrayNotEmpty()
    @IsValidObjectId({
        each: true,
        message: 'service offered  id must be a valid MongoDB ObjectId',
    })
    @TransformToObjectId()
    servicesOffered: Types.ObjectId[];

    /* ---------------- CONSENT (FormData booleans) ---------------- */



    /* ---------------- WORKFLOW ---------------- */


}
