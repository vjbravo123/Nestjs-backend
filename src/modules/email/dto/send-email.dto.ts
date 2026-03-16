import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class SendEmailDto {
  @IsEmail()
  to: string;

  @IsNotEmpty()
  template: string;

  @IsOptional()
  data?: Record<string, any>;
}
