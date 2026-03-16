// create-theme.dto.ts
import { IsString, IsOptional, IsIn, IsBoolean } from 'class-validator';

export class CreateThemeDto {
    @IsString()
    name: string;

    @IsString()
    description: string;

    @IsString()
    tag: string;

    @IsString()
    @IsIn(['birthDay', 'curated']) // Add more values here if needed
    eventType: string;

    @IsString()
    @IsOptional()
    icon?: string;

    @IsString()
    @IsOptional()
    themeImage?: string;

    @IsBoolean()
    @IsOptional()
    active?: boolean;
}
