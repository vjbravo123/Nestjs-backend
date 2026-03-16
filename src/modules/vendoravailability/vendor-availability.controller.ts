import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  ForbiddenException,
  Param,
  NotFoundException,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Delete,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../common/casl/policies.guard';
import { CheckPolicies } from '../../common/casl/check-policies.decorator';
import { Action } from '../../common/casl/app-ability';

import { VendorAvailabilityService } from './vendor-availability.service';
import {
  CreateWeeklyDto,
  WeeklySlotsDto,
  OverrideDto,
  RangeDto,
} from './dto/create-vendor-availability.dto';

import { MongoIdPipe } from '../../common/pipes/parse-objectid.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { Types } from 'mongoose';
import { Roles } from '../../common/decorators/roles.decorator';
@ApiTags('Vendor Availability')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('vendor-availability')
export class VendorAvailabilityController {
  constructor(
    private readonly availabilityService: VendorAvailabilityService,
  ) {}

  // ✅ WEEKLY DAYS
  @Post('weekly')
  @CheckPolicies((ability) => ability.can(Action.Manage, 'VendorAvailability'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set weekly availability days' })
  async setWeeklyAvailability(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWeeklyDto,
  ) {
    const data = await this.availabilityService.setWeeklyAvailability(
      user.vendorId!,
      dto,
    );

    return { message: 'Weekly availability updated successfully.', data };
  }

  // ✅ WEEKLY SLOTS (NEW)
  @Post('weekly-slots')
  @CheckPolicies((ability) => ability.can(Action.Manage, 'VendorAvailability'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set weekly slots per weekday' })
  async setWeeklySlots(
    @CurrentUser() user: AuthUser,
    @Body() dto: WeeklySlotsDto,
  ) {
    const data = await this.availabilityService.setWeeklySlots(
      user.vendorId!,
      dto,
    );

    return {
      message: 'Weekly slots updated successfully.',
      data,
    };
  }

  // ✅ OVERRIDE (now supports slots)
  @Post('override')
  @CheckPolicies((ability) => ability.can(Action.Manage, 'VendorAvailability'))
  @ApiOperation({ summary: 'Add a single-day override (with slots)' })
  async addOverride(@CurrentUser() user: AuthUser, @Body() dto: OverrideDto) {
    const data = await this.availabilityService.addOverride(
      user.vendorId!,
      dto,
    );

    return { message: 'Override added successfully.', data };
  }

  // ✅ RANGE (now supports slots)
  @Post('range')
  @CheckPolicies((ability) => ability.can(Action.Manage, 'VendorAvailability'))
  @ApiOperation({ summary: 'Add availability range override (with slots)' })
  async addRange(@CurrentUser() user: AuthUser, @Body() dto: RangeDto) {
    const data = await this.availabilityService.addRange(user.vendorId!, dto);

    return { message: 'Range availability saved successfully.', data };
  }

  // ✅ GET ALL SETTINGS
  @Get()
  @CheckPolicies((ability) => ability.can(Action.Manage, 'VendorAvailability'))
  @ApiOperation({ summary: 'Get vendor full availability calendar' })
  async getVendorAvailability(@CurrentUser() user: AuthUser): Promise<any> {
    const data = await this.availabilityService.getVendorAvailability(user.vendorId!);

    return { message: 'Vendor availability fetched successfully.', data };
  }

  @Get('is-managed')
  @Roles('vendor')
  @ApiOperation({ summary: 'Check if vendor availability is managed' })
  async isAvailabilityManaged(@CurrentUser() user: AuthUser) {
    if (!user?.vendorId) throw new ForbiddenException('Vendor ID missing in token.');

    const data = await this.availabilityService.isAvailabilityManaged(user.vendorId);

    return { message: 'Vendor availability status fetched.', data };
  }

  // ✅ CHECK
  @Get('check')
  @CheckPolicies((ability) => ability.can(Action.Manage, 'VendorAvailability'))
  @ApiOperation({ summary: 'Check vendor availability on a specific date' })
  async checkAvailability(
    @CurrentUser() user: AuthUser,
    @Query('date') dateStr: string,
  ) {
    if (!dateStr) throw new BadRequestException('date is required.');

    return this.availabilityService.checkAvailability(user.vendorId!, dateStr);
  }

  // ✅ DELETE override
  @Delete('override/:overrideId')
  @CheckPolicies((ability) => ability.can(Action.Delete, 'VendorAvailability'))
  @ApiOperation({ summary: 'Delete override by ID' })
  async deleteOverride(
    @CurrentUser() user: AuthUser,
    @Param('overrideId') overrideId: string,
  ) {
    const updated = await this.availabilityService.deleteOverride(
      user.vendorId!,
      overrideId,
    );
    if (!updated) throw new NotFoundException('Override not found');

    return { message: 'Override removed successfully.' };
  }

  // ✅ DELETE range
  @Delete('range/:rangeId')
  @CheckPolicies((ability) => ability.can(Action.Delete, 'VendorAvailability'))
  @ApiOperation({ summary: 'Delete range by ID' })
  async deleteRange(
    @CurrentUser() user: AuthUser,
    @Param('rangeId', MongoIdPipe) rangeId: string,
  ) {
    const updated = await this.availabilityService.deleteRange(
      user.vendorId!,
      rangeId,
    );
    if (!updated) throw new NotFoundException('Range not found');

    return { message: 'Range removed successfully.' };
  }

  // ✅ CHECK UNAVAILABILITY for a specific date
  @Get('unavailable/:vendorId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'VendorAvailability'))
  @ApiOperation({
    summary:
      'Check if vendor is unavailable on a specific date (day/month/year)',
  })
  async checkUnavailability(
    @Param('vendorId', MongoIdPipe) vendorId: string,
    @Query('day') day: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    if (!day || !month || !year) {
      throw new BadRequestException('day, month, and year are required.');
    }

    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);

    if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) {
      throw new BadRequestException(
        'day, month, and year must be valid numbers.',
      );
    }

    if (monthNum < 1 || monthNum > 12) {
      throw new BadRequestException('month must be between 1 and 12.');
    }

    if (dayNum < 1 || dayNum > 31) {
      throw new BadRequestException('day must be between 1 and 31.');
    }

    // Build ISO date string: YYYY-MM-DD
    const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

    const data = await this.availabilityService.checkUnavailability(
      new Types.ObjectId(vendorId),
      dateStr,
    );

    return { message: 'Unavailability check completed.', data };
  }

  // ✅ GET ALL UNAVAILABLE DATES for a month/year
  @Get('unavailable-dates')
  @CheckPolicies((ability) => ability.can(Action.Read, 'VendorAvailability'))
  @ApiOperation({
    summary: 'Get all unavailable dates for a vendor in a date range',
  })
  async getUnavailableDates(
    @Query('vendorId', MongoIdPipe) vendorId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required.');
    }

    // ✅ basic ISO validation
    if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
      throw new BadRequestException(
        'startDate and endDate must be valid dates.',
      );
    }

    const data = await this.availabilityService.getUnavailableDatesByRange(
      new Types.ObjectId(vendorId),
      startDate,
      endDate,
    );

    return {
      message: 'Unavailable dates fetched successfully.',
      data, // { unavailableDates: [...] }
    };
  }
}
