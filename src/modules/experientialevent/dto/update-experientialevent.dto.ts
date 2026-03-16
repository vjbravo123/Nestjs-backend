import { PartialType } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { Validate } from 'class-validator';
import { IsValidObjectId, TransformToObjectId } from '../../../common/validators/is-valid-objectid.validator';
import { Types } from 'mongoose';
import { CreateExperientialEventDto } from './create-experientialevent.dto';
import { IsArray, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { parseStringifiedArray } from 'src/common/utils/parse-stringified-array.util';

export class UpdateExperientialEventDto extends PartialType(CreateExperientialEventDto) { }
export class UpdateExperientialEventByVendorDto extends PartialType(CreateExperientialEventDto) {
    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    addBanner?: string[];       // ✅ new banners to upload
    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    removeBanners?: string[];   // ✅ banners vendor want to remove

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    existingBanners?: string[];   // ✅ banners vendor want to keep
}

export class UpdateExperientialEventByAdminDto extends PartialType(CreateExperientialEventDto) {


    @IsOptional()
    @IsValidObjectId({ message: 'ExperientialEvent Category must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    experientialEventCategory?: string;


    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    @Transform(parseStringifiedArray)
    delight?: string[];


    @IsOptional()
    @IsValidObjectId({ message: 'Sub-experientialEvent Category must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    subExperientialEventCategory?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    removeBanners?: string[];
}




export class AddBannerByAdminDto {
    // @ApiProperty({ example: '671a12ef2ab03a3b4f1e4567', description: 'Event ID to which banners will be added' })
    // @IsMongoId()
    // eventId: string;

    // @ApiProperty({
    //     description: 'If true, banners will be added to pendingChanges.banner instead of main event banner',
    //     required: false,
    // })
    @IsOptional()
    toPendingChanges?: boolean = false;
}



export class DeleteBannerDto {
    @IsString()
    @IsNotEmpty()
    bannerUrl: string;
}
