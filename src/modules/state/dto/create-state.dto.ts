import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsLatitude,
  IsLongitude,
  IsBoolean,
  IsArray,
  IsMongoId,
} from 'class-validator';

export class CreateStateDto {
  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsOptional()
  @IsString()
  formattedAddress?: string;

  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;

  @IsString()
  @IsNotEmpty()
  place_id: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  cities?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
