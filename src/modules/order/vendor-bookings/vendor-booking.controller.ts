import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Req,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Res, Header, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { VendorOrdersQueryDto } from '../dto/vendor-orders-query.dto';
import { VendorBookingService } from './vendor-booking.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../auth/types/auth-user.type';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { OwnershipGuard } from '../../../common/guards/ownership.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequireOwnership } from '../../../common/decorators/ownership.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { AddonUnavailableDatesQueryDto } from '../dto/AddonUnavailableDatesQueryDto';
import { AddonAvailableSlotsQueryDto } from '../dto/AddonAvailableSlotsQueryDto';
import { VendorBookingsQueryDto } from '../dto/vendor-bookings-query.dto';
import { Types } from 'mongoose';
import { MongoIdPipe } from 'src/common/pipes/parse-objectid.pipe';
@Controller('vendor-bookings')
export class VendorBookingController {
  constructor(private readonly vendorBookingService: VendorBookingService) { }

  // ------------------------------------------------
  // Vendor: Get my bookings
  // ------------------------------------------------
  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles(UserRole.VENDOR)
  @RequireOwnership('vendorId')
  async getVendorBookings(
    @Query() query: VendorOrdersQueryDto,
    @CurrentUser() { vendorId }: AuthUser,
  ) {
    return this.vendorBookingService.getOrdersForVendor(vendorId!, query);
  }

  @Get('addon/unavailable-dates')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'vendor', 'admin')
  async getAddonUnavailableDates(@Query() q: AddonUnavailableDatesQueryDto) {
    return this.vendorBookingService.getAddonUnavailableDates({
      eventId: q.eventId,
      city: q.city,
      month: q.month,
      year: q.year,
    });
  }

  @Get('addon/available-slots')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('user', 'vendor', 'admin')
  async getAddonAvailableSlots(@Query() q: AddonAvailableSlotsQueryDto) {
    return this.vendorBookingService.getAddonAvailableSlots({
      eventId: q.eventId,
      city: q.city,
      date: q.date,
    });
  }

  @Get('vendor/next-upcoming')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor')
  async getNextUpcomingOrder(
    @CurrentUser() { vendorId }: AuthUser,
    @Req() req,
  ) {
    if (!vendorId) throw new ForbiddenException('Forbidden ...');
    return this.vendorBookingService.getNextUpcomingVendorBookings(vendorId);
  }


  // ------------------------------------------------
  // Vendor: Get booking details by id
  // ------------------------------------------------
  @Get(':bookingId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  async getVendorBookingDetails(

    @Param('bookingId', MongoIdPipe) bookingId: Types.ObjectId,
    @CurrentUser() { vendorId }: AuthUser,
  ) {
    if (!vendorId) {
      throw new ForbiddenException('Vendor access denied');
    }

    return this.vendorBookingService.getVendorBookingDetails(
      vendorId,
      bookingId,
    );
  }


}
