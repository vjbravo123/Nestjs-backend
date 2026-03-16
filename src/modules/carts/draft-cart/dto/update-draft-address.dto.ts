import { IsNotEmpty, IsDateString, IsBoolean, IsString, IsOptional } from 'class-validator';
import { Types } from 'mongoose';
import { IsValidObjectId, TransformToObjectId } from '../../../../common/validators/is-valid-objectid.validator';
import { Type } from 'class-transformer'
export class UpdateDraftAddressDto {
    @IsNotEmpty()
    @IsValidObjectId({ message: 'Address id  must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    addressId: Types.ObjectId;


    @IsBoolean()
    @IsOptional()
    @Type(() => Boolean)
    isPlanner: boolean


}
