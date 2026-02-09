// src/auth/dto/login.dto.ts

import { IsNotEmpty, IsString, IsIn, IsNumber, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';
export class LoginDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  mobile: number;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  role?: string;


}
