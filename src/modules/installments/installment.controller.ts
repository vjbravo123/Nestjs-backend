import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Req,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { RequireOwnership } from '../../common/decorators/ownership.decorator';
import { InstallmentQueryDto } from './dto/admin-installment-query.dto';
import { InstallmentService } from './installment.service';
import { CreateInstallmentScheduleDto } from './dto/create-installment-schedule.dto';
import { UpdateInstallmentStatusDto } from './dto/update-installment-status.dto';

import { AuthUser } from '../auth/types/auth-user.type';

import { UserInstallmentQueryDto } from './dto/user-installment-query.dto';

@Controller('installments')
export class InstallmentController {
  constructor(private readonly installmentService: InstallmentService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateInstallmentScheduleDto,
  ) {
    if (!user?.userId) throw new BadRequestException('User ID missing');

    return this.installmentService.createSchedule(user.userId, dto);
  }

  @Patch('pay')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  async payInstallment(@Body() dto: UpdateInstallmentStatusDto) {
    return this.installmentService.markInstallmentPaid(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('user')
  @RequireOwnership('userId')
  async getMyInstallments(
    @Query() q: UserInstallmentQueryDto,
    @CurrentUser() { userId }: AuthUser,
    @Req() req,
  ) {
    return this.installmentService.getInstallmentsForUser(userId!, q);
  }

  @Get('/admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getAllForAdmin(@Query() query: InstallmentQueryDto) {
    return this.installmentService.getAllForAdminWithQuery(query);
  }

  @Get('user/all')
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('user')
  @RequireOwnership('userId')
  async getMy(@CurrentUser() user: any) {
    return this.installmentService.getUserInstallments(user.userId);
  }

  @Get(':bookingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getByBooking(@Param('bookingId') bookingId: string) {
    return this.installmentService.getByBooking(bookingId);
  }
}
