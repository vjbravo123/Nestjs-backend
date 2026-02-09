import { IsString, IsNotEmpty, IsOptional, IsMongoId } from 'class-validator';

export class CreateSubExperientialEventCategoryDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsMongoId()
    @IsNotEmpty()
    experientialEventCategoryId: string;

    @IsString()
    @IsOptional()
    description?: string;
}
