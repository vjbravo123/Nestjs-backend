import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  Param,
  NotFoundException,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
  Delete,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

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

@ApiTags('Vendor Availability')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vendor-availability')
export class VendorAvailabilityController {
  constructor(private readonly availabilityService: VendorAvailabilityService) { }

  // ✅ WEEKLY DAYS
  @Post('weekly')
  @Roles('vendor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set weekly availability days' })
  async setWeeklyAvailability(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWeeklyDto,
  ) {
    if (!user?.vendorId) throw new ForbiddenException('Vendor ID missing in token.');
    const data = await this.availabilityService.setWeeklyAvailability(user.vendorId, dto);

    return { message: 'Weekly availability updated successfully.', data };
  }

  // ✅ WEEKLY SLOTS (NEW)
  @Post('weekly-slots')
  @Roles('vendor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set weekly slots per weekday' })
  async setWeeklySlots(
    @CurrentUser() user: AuthUser,
    @Body() dto: WeeklySlotsDto,
  ) {
    if (!user?.vendorId) throw new ForbiddenException('Vendor ID missing in token.');

    const data = await this.availabilityService.setWeeklySlots(user.vendorId, dto);

    return {
      message: 'Weekly slots updated successfully.',
      data,
    };
  }

  // ✅ OVERRIDE (now supports slots)
  @Post('override')
  @Roles('vendor')
  @ApiOperation({ summary: 'Add a single-day override (with slots)' })
  async addOverride(@CurrentUser() user: AuthUser, @Body() dto: OverrideDto) {
    if (!user?.vendorId) throw new ForbiddenException('Vendor ID missing in token.');
    const data = await this.availabilityService.addOverride(user.vendorId, dto);

    return { message: 'Override added successfully.', data };
  }

  // ✅ RANGE (now supports slots)
  @Post('range')
  @Roles('vendor')
  @ApiOperation({ summary: 'Add availability range override (with slots)' })
  async addRange(@CurrentUser() user: AuthUser, @Body() dto: RangeDto) {
    if (!user?.vendorId) throw new ForbiddenException('Vendor ID missing in token.');

    const data = await this.availabilityService.addRange(user.vendorId, dto);

    return { message: 'Range availability saved successfully.', data };
  }

  // ✅ GET ALL SETTINGS
  @Get()
  @Roles('vendor')
  @ApiOperation({ summary: 'Get vendor full availability calendar' })
  async getVendorAvailability(@CurrentUser() user: AuthUser) {
    if (!user?.vendorId) throw new ForbiddenException('Vendor ID missing in token.');

    const data = await this.availabilityService.getVendorAvailability(user.vendorId);

    return { message: 'Vendor availability fetched successfully.', data };
  }

  // ✅ CHECK
  @Get('check')
  @Roles('vendor')
  @ApiOperation({ summary: 'Check vendor availability on a specific date' })
  async checkAvailability(
    @CurrentUser() user: AuthUser,
    @Query('date') dateStr: string,
  ) {
    if (!user?.vendorId) throw new ForbiddenException('Vendor ID missing in token.');
    if (!dateStr) throw new BadRequestException('date is required.');

    return this.availabilityService.checkAvailability(user.vendorId, dateStr);
  }

  // ✅ DELETE override
  @Delete('override/:overrideId')
  @Roles('vendor')
  @ApiOperation({ summary: 'Delete override by ID' })
  async deleteOverride(@CurrentUser() user: AuthUser, @Param('overrideId') overrideId: string) {
    if (!user?.vendorId) throw new ForbiddenException('Vendor ID missing in token.');

    const updated = await this.availabilityService.deleteOverride(user.vendorId, overrideId);
    if (!updated) throw new NotFoundException('Override not found');

    return { message: 'Override removed successfully.' };
  }

  // ✅ DELETE range
  @Delete('range/:rangeId')
  @Roles('vendor')
  @ApiOperation({ summary: 'Delete range by ID' })
  async deleteRange(
    @CurrentUser() user: AuthUser,
    @Param('rangeId', MongoIdPipe) rangeId: string,
  ) {
    if (!user?.vendorId) throw new ForbiddenException('Vendor ID missing in token.');

    const updated = await this.availabilityService.deleteRange(user.vendorId, rangeId);
    if (!updated) throw new NotFoundException('Range not found');

    return { message: 'Range removed successfully.' };
  }
}
