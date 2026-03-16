import { IsMongoId, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
export class CreateReviewDto {
    @IsMongoId()
    event: string;

    @IsMongoId()
    orderId: string;

    @IsNumber()
    @Type(() => Number)
    @Min(1)
    @Max(5)
    rating: number;

    @IsString()
    @IsOptional()
    comment?: string;

    @IsString()
    @IsOptional()
    image?: string; // URL or path to the review image
}