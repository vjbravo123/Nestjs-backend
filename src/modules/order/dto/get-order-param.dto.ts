import { IsMongoId, IsNotEmpty } from 'class-validator';

export class GetOrderParamDto {
  @IsMongoId({ message: 'Invalid orderId format' })
  @IsNotEmpty({ message: 'orderId is required' })
  orderId: string;
}
