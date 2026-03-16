import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PaymentMilestoneService } from './payment-milestone.service';
import {
  CreatePaymentMilestoneDto,
  UpdatePaymentMilestoneDto,
} from '../dto/update-payment-milestone.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@Controller('payment-milestone')
export class PaymentMilestoneController {
  constructor(
    private readonly milestoneService: PaymentMilestoneService,
  ) { }

  /* ------------------------------------------------
     GET ALL PAYMENT MILESTONES
  ------------------------------------------------ */
  @Get()
  async getAll() {
    const data = await this.milestoneService.getAll();
    return {
      message: 'Payment milestones fetched successfully.',
      data,
    };
  }

  /* ------------------------------------------------
     GET PAYMENT MILESTONE BY ID
  ------------------------------------------------ */
  @Get(':id')
  async getById(@Param('id') id: string) {
    const data = await this.milestoneService.getById(id);
    return {
      message: 'Payment milestone fetched successfully.',
      data,
    };
  }

  /* ------------------------------------------------
     CREATE PAYMENT MILESTONE (ADMIN ONLY)
  ------------------------------------------------ */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(
    @Body() dto: CreatePaymentMilestoneDto,
  ) {
    const data = await this.milestoneService.create(dto);
    return {
      message: 'Payment milestone created successfully.',
      data,
    };
  }

  /* ------------------------------------------------
     UPDATE PAYMENT MILESTONE BY ID (ADMIN ONLY)
  ------------------------------------------------ */
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMilestoneDto,
  ) {
    const data = await this.milestoneService.update(id, dto);
    return {
      message: 'Payment milestone updated successfully.',
      data,
    };
  }

  /* ------------------------------------------------
     DELETE PAYMENT MILESTONE BY ID (ADMIN ONLY)
  ------------------------------------------------ */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async delete(
    @Param('id') id: string,
  ) {
    const data = await this.milestoneService.delete(id);
    return {
      message: 'Payment milestone deleted successfully.',
      data,
    };
  }
}
