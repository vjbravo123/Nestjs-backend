import { Type } from 'class-transformer';
import { IsArray, ValidateNested, IsNotEmpty, IsOptional } from 'class-validator';

import { TransformToObjectId, IsValidObjectId } from 'src/common/validators/is-valid-objectid.validator';
import { Types } from 'mongoose';

export class DraftAddonInputDto {
    @IsNotEmpty()
    @IsValidObjectId({ message: 'addonId must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    addonId: Types.ObjectId;

    @IsNotEmpty()
    @IsValidObjectId({ message: 'tierId must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    tierId: Types.ObjectId;

    @IsOptional()
    @Type(() => Boolean)
    remove?: boolean;
}

export class UpdateDraftAddonsDto {
    @IsArray()

    @ValidateNested({ each: true })
    @Type(() => DraftAddonInputDto)
    addons?: DraftAddonInputDto[];
}
