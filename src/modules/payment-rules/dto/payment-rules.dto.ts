import { IsString, IsNumber, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';


class MilestoneTemplateDto {
    @IsString()
    name: string;

    @IsNumber()
    daysBeforeEvent: number;

    @IsNumber()
    targetPercentage: number;
}


export class CreatePaymentRuleDto {
    @IsString()
    ruleName: string;  

    @IsNumber()
    minLeadTimeDays: number; 

    @IsNumber()
    maxLeadTimeDays: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MilestoneTemplateDto)
    milestones: MilestoneTemplateDto[]; 
}


export class UpdatePaymentRuleDto {
    @IsOptional()
    @IsString()
    ruleName?: string;

    @IsOptional()
    @IsNumber()
    minLeadTimeDays?: number;

    @IsOptional()
    @IsNumber()
    maxLeadTimeDays?: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MilestoneTemplateDto)
    milestones?: MilestoneTemplateDto[];
}   