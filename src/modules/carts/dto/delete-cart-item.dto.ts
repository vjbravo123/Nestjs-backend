import { IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { IsValidObjectId, TransformToObjectId } from '../../../common/validators/is-valid-objectid.validator';

export class DeleteCartItemDto {
    // id of the embedded cart item (Cart.items._id)
    @IsNotEmpty()
    @IsValidObjectId({ message: 'cartItemId must be a valid ObjectId' })
    @TransformToObjectId()
    cartItemId: Types.ObjectId;
}
