import { IsOptional, IsEnum, IsNumberString, IsString } from 'class-validator';
import { MediaType } from '../enums/media-type.enum';

export class AdminQueryMediaDto {
    @IsOptional()
    @IsEnum(MediaType)
    mediaType?: MediaType;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsNumberString()
    page?: number;

    @IsOptional()
    @IsNumberString()
    limit?: number;
}
