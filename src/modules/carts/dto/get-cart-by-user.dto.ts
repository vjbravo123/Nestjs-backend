// src/carts/dto/get-cart-by-user.dto.ts
import { IsOptional, IsIn, IsNumberString } from 'class-validator';

export class GetCartByUserQueryDto {
    @IsOptional()
    @IsNumberString()
    page?: string;

    @IsOptional()
    @IsNumberString()
    limit?: string;

    // control level of populate/detail returned
    @IsOptional()
    @IsIn(['summary', 'full'])
    include?: 'summary' | 'full';
}
