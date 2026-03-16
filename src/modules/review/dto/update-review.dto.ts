import { IsNumber, IsOptional, IsString, Min, Max, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
export class AdminUpdateReviewDto {
    @IsOptional()
    @IsNumber()
@Type(() => Number)
    @Min(1)
    @Max(5)
    rating?: number;

    @IsOptional()
    @IsString()
    comment?: string;

    @IsOptional()
    @IsString()
    @IsIn(['pending', 'approve', 'reject'])
    status?: 'pending' | 'approve' | 'reject';
}
