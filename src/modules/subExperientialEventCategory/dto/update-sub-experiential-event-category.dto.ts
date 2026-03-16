import { PartialType } from '@nestjs/mapped-types';
import { CreateSubExperientialEventCategoryDto } from './create-sub-experiential-event-category.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSubExperientialEventCategoryDto extends PartialType(
    CreateSubExperientialEventCategoryDto,
) {
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
