import { IsArray, IsDateString, IsNumber, IsNotEmpty, IsOptional, IsString, Min, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCartDto {
  @IsOptional()
  @IsString()
  eventId?: string;



  @IsOptional()
  @IsString()
  eventTitle?: string;




  @IsOptional()
  @IsString()
  selectedTierId?: string;



  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const cleaned = value.trim().replace(/\n/g, '').replace(/\r/g, '').replace(/\s+/g, ' ');
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    }
    return value;
  })
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
  @Min(1)
  guests?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  plannerPrice?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(['active', 'ordered'])
  status?: 'active' | 'ordered';

  @IsOptional()
  @IsNumber()
  @Min(0)
  itemTotal?: number;
}


