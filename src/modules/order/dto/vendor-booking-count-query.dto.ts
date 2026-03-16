import { IsOptional, IsString, IsDateString } from 'class-validator';

export class VendorBookingCountQueryDto {
    @IsOptional()
    @IsString()
    startDate?: string; // ISO date string

    @IsOptional()
    @IsString()
    endDate?: string; // ISO date string
}
