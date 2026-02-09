// src/orders/dto/admin-orders-query.dto.ts
import { IsOptional, IsEnum, IsString, IsInt, Min, Max, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';
import { IsValidObjectId, TransformToObjectId } from '../../../common/validators/is-valid-objectid.validator';
export enum OrderSortField {
    CREATED_AT = 'createdAt',
    TOTAL = 'totalAmount',
    STATUS = 'status',
    ORDER_NUMBER = 'orderNumber',
}

export class AdminOrdersQueryDto {
    @IsOptional()
    @IsString()
    search?: string; // orderNumber or user email/phone

    @IsOptional()
    @IsEnum(['pending', 'paid', 'payment_failed', 'processing', 'completed', 'cancelled', 'refunded'])
    status?: string;

    @IsOptional()
    @IsMongoId()
    @IsValidObjectId({ message: 'Event ID must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    userId?: Types.ObjectId;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit?: number = 25;

    @IsOptional()
    @IsEnum(OrderSortField)
    sortBy?: OrderSortField = OrderSortField.CREATED_AT;

    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortDir?: 'asc' | 'desc' = 'desc';

    @IsOptional()
    @IsString()
    startDate?: string; // ISO date

    @IsOptional()
    @IsString()
    endDate?: string; // ISO date
}
