import { IsArray, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { parseStringifiedArray } from '../../../common/utils/parse-stringified-array.util';




export class AddToCartDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  eventTitle: string;



  @IsString()
  @IsNotEmpty()
  selectedTierId: string;

  @IsOptional()
  @IsArray()
  addOnIds?: string[];



  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @IsOptional()
  @IsString()
  eventTime?: string;

  @IsOptional()
  @IsString()
  eventAddress?: string;

  @IsOptional()
  @IsString()
  addressId?: string;

  @IsOptional()
  @IsNumber()
  guests?: number;

  @IsOptional()
  @IsString()
  location?: string;
}


