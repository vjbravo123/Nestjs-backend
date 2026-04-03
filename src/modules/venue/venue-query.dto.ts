import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsNumber, IsIn, Min } from 'class-validator';

export class VenueQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(0)
  minGuests?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  @IsOptional()
  @IsIn(['price_low', 'price_high', 'newest'])
  sortBy?: 'price_low' | 'price_high' | 'newest';
}