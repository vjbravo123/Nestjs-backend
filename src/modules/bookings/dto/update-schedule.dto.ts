import { IsArray, ValidateNested, IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

class MilestoneDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  dueDate: Date;

  @IsNumber()
  amount: number;

  @IsString()
  @IsEnum(['Paid', 'Pending', 'Overdue'])
  status: string;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}

export class UpdateScheduleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneDto)
  milestones: MilestoneDto[];
}