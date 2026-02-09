import { IsString, IsOptional, IsArray, IsMongoId, IsNumber, IsBoolean } from 'class-validator';
import { CreateAddOnDto } from './create-addon.dto';
import { Transform, Type } from 'class-transformer';
import { PartialType, OmitType } from '@nestjs/mapped-types';
export class UpdateAddOnDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsMongoId()
  @IsOptional()
  category?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxQuantity?: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsBoolean()
  @IsOptional()
  popular?: boolean;
}





export class VendorEditAddOnDto extends PartialType(
  OmitType(CreateAddOnDto, ['popular'] as const),
) {
  // 🆕 Add extra fields here

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bannerToRemove?: string[];


  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  addBanner?: string[];



}