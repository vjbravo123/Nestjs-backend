// src/orders/dto/admin-orders-query.dto.ts
import { IsOptional, IsEnum, IsString, IsInt, Min, Max, IsMongoId, IsArray } from 'class-validator';
import { ToBoolean } from 'src/common/utils/transFormTOBoolean';
import { Type, Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { IsValidObjectId, TransformToObjectId } from '../../../common/validators/is-valid-objectid.validator';
export enum OrderSortField {
    CREATED_AT = 'createdAt',
    TOTAL = 'totalAmount',
    STATUS = 'status',
    ORDER_NUMBER = 'orderNumber',
}



export class VendorOrdersQueryDto {

    @IsOptional()
    @IsArray()
    @IsMongoId({ each: true })
    @Transform(({ value }) => {
        if (typeof value === 'string') return value.split(',').map((id: string) => id.trim());
        return value;
    })
    vendorIds?: string[];

    @IsOptional()
    @IsEnum(['pending', 'paid', 'payment_failed', 'processing', 'completed', 'cancelled', 'refunded'])
    status?: string;


    @IsOptional()
    @ToBoolean()
    upcoming?: boolean;



    @IsOptional()
    @ToBoolean()
    recentBooking?: boolean;


    // @IsOptional()
    // @IsMongoId()
    // @IsValidObjectId({ message: 'Event ID must be a valid MongoDB ObjectId' })
    // @TransformToObjectId()
    // userId?: Types.ObjectId;

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

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    date?: string; // ISO date (YYYY-MM-DD) for single date availability query
}
