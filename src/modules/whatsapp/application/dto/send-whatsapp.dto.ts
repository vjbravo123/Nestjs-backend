import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';

export class SendWhatsAppDto {
  @IsString()
  to: string;

  @IsString()
  template: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsArray()
  @IsOptional()
  variables?: string[];

  @IsObject()
  @IsOptional()
  meta?: Record<string, any>;
}
