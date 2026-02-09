// update-theme.dto.ts
import { IsString, IsOptional, IsIn, IsBoolean } from 'class-validator';

export class UpdateThemeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  tag?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  themeImage?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsString()
  @IsIn(['birthDay','curated'])
  @IsOptional()
  eventType?: string;
}
