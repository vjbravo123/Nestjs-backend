    import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTalkToExpertDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  contactMethod: string;

  @IsString()
  @IsNotEmpty()
  preferredTime: string;
}