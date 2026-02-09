import { IsNotEmpty, IsOptional } from 'class-validator';
import { Types } from 'mongoose';
import { IsValidObjectId, TransformToObjectId } from '../../../common/validators/is-valid-objectid.validator';

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

    @IsOptional()
    remove?: boolean;
}
