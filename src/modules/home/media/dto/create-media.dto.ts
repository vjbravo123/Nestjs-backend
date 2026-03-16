import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { MediaType } from '../enums/media-type.enum';

export class CreateMediaDto {
  @IsEnum(MediaType, { message: 'mediaType must be image or video' })
  mediaType: MediaType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}
