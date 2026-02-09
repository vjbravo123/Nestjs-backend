import { IsString, IsBoolean, ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsEnum, IsMongoId } from 'class-validator';
import { Types } from 'mongoose';
import { IsValidObjectId, TransformToObjectId } from 'src/common/validators/is-valid-objectid.validator';
export class CreateOrderDto {

  @IsNotEmpty()
  @IsValidObjectId({ message: 'Cart ID must be a valid MongoDB ObjectId' })
  @TransformToObjectId()
  cartId: Types.ObjectId;

  // @IsArray()
  // @ArrayMinSize(1)
  // @IsMongoId({ each: true })

  // selectedItem: string[];

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsBoolean()
  agreeToTerms: boolean;

  @IsString()
  paymentMethod: string


  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  paymentDetails?: any;
}
