import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

// 1. Define the structure of a Milestone Template (Frontend sends this)
class RuleMilestoneDto {
  @IsString()
  id: string; // Frontend generated ID (e.g., 'm-1234')

  @IsString()
  name: string;

  @IsNumber()
  percent: number;

  @IsOptional()
  @IsNumber()
  daysBefore: number | null; // null = At Booking

  @IsString()
  @IsEnum(['deposit', 'installment', 'final'])
  type: string;
}

// 2. Define the structure of a Rule
class PaymentRuleDto {
  @IsString()
  ruleId: string;

  @IsString()
  name: string;

  @IsNumber()
  rangeStart: number;

  @IsOptional()
  @IsNumber()
  rangeEnd: number;

  @IsNumber()
  minFlatDeposit: number;

  @IsString()
  color: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleMilestoneDto)
  milestones: RuleMilestoneDto[];
}

// 3. The Main DTO for the Controller
export class UpdatePaymentRulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentRuleDto)
  rules: PaymentRuleDto[];
}