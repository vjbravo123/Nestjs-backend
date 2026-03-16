import { IsNotEmpty, IsOptional, IsArray, IsEnum } from 'class-validator';
import { Types } from 'mongoose';
import { IsValidObjectId, TransformToObjectId } from '../../../common/validators/is-valid-objectid.validator';
import { SlotType } from '../../vendoravailability/vendor-availability.schema';

export class UpdateAddonInCartDto {
    @IsNotEmpty()
    @IsValidObjectId({ message: 'cartItemId must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    cartItemId: Types.ObjectId;

    @IsNotEmpty()
    @IsValidObjectId({ message: 'addonId must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    addonId: Types.ObjectId;

    @IsValidObjectId({ message: 'tierId must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    tierId: Types.ObjectId;

    @IsNotEmpty({ message: 'slots is required' })
    @IsArray()
    @IsEnum(SlotType, { each: true, message: 'Each slot must be a valid SlotType (breakfast, lunch, tea, dinner)' })
    slots: SlotType[];

    @IsOptional()
    remove?: boolean;
}
