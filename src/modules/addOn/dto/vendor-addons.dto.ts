// 📁 src/addOn/dto/vendor-query-addon.dto.ts
import { IsOptional, IsBoolean, IsMongoId, IsString, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';
export class VendorQueryAddOnDto {
    @IsOptional() @IsString() search?: string;
    @IsOptional() @IsMongoId() category?: string;
    @IsOptional() @IsString() city?: string;
    @IsOptional() @IsBoolean() isActive?: boolean;
    @IsOptional() @IsBoolean() popular?: boolean;
    @IsOptional() @IsString() updateStatus?: string;
    @IsOptional() @IsString() isVerify?: boolean;

    @IsOptional() @Type(() => Number) @IsNumber() page?: number;
    @IsOptional() @Type(() => Number) @IsNumber() limit?: number;
    @IsOptional() @IsString() sortBy?: string;
    @IsOptional() @IsString() select?: string;
    @IsOptional() @IsString() populate?: string;
    @IsOptional() @IsString() cursor?: string;
}
