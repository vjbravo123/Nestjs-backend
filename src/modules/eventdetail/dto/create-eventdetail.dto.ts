import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateEventDetailDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsIn(['highlight', 'include', 'policy'])
    type: string;
}