import {
  IsNumber,
  IsArray,
  IsOptional,
  Min,
  Max,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/* -------------------- SUB DTO -------------------- */

class MilestoneItemDto {
  @IsNumber()
  @Min(1)
  daysRemaining: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  percentage: number;
}

/* -------------------- CREATE DTO -------------------- */

export class CreatePaymentMilestoneDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MilestoneItemDto)
  milestonesData: MilestoneItemDto[];

  @IsNumber()
  @Min(1)
  @Max(100)
  totalPercentage: number;
}

/* -------------------- UPDATE DTO -------------------- */

export class UpdatePaymentMilestoneDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MilestoneItemDto)
  milestonesData?: MilestoneItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  totalPercentage?: number;
}
