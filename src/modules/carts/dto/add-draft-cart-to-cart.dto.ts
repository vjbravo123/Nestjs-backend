import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Types } from 'mongoose';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';
import { ToBoolean } from 'src/common/utils/transFormTOBoolean';
export class AddDraftCartToCartDto {


    @IsOptional()
    @ToBoolean()
    forceUpdate?: boolean;


}
