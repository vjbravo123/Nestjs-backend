    import { PartialType } from '@nestjs/mapped-types';
    import { CreateVenueDto } from './create-venue.dto';
    import { IsArray, IsOptional, IsString } from 'class-validator';

    export class UpdateVenueDto extends PartialType(CreateVenueDto) {
        @IsOptional()
        @IsArray()
        @IsString({ each: true })
        images?: string[];
    }