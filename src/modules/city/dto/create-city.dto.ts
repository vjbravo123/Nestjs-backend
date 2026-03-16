import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsLatitude,
  IsLongitude,
  IsBoolean,
} from 'class-validator';

export class CreateCityDto {
  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  formattedAddress?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string | null;

  @IsOptional()
  @IsString()
  sublocality?: string | null;

  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;

  @IsString()
  @IsNotEmpty()
  place_id: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
