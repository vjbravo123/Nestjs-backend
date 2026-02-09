import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class CreateDropdownOptionDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(["ageGroup", "role", 'businessType', "priceRange", "experientialEventCategory"]) // match the schema enum
  type: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  extra?: any;
}