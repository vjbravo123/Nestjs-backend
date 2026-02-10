import { Controller, Get, Post, Put, Body, Param, Delete, Patch, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { UpdatePaymentRulesDto } from './dto/update-rules.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  createBooking(@Body() dto: CreateBookingDto) {
    return this.bookingsService.create(dto);
  }


  // 1. All Bookings Page
  @Get()
  getAllBookings() {
    return this.bookingsService.findAll();
  }

  // 2. Booking Details Page
  @Get(':id')
  getBooking(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  // 3. Record Payment (Modal)
  @Post(':id/payments')
  recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.bookingsService.recordPayment(id, dto);
  }

  // 4. Update Schedule (Booking Rules Page)
  @Put(':id/milestones')
  updateSchedule(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.bookingsService.updateSchedule(id, dto);
  }

   //5.NEW: Cancel Booking Endpoint
  @Patch(':id/cancel')
  cancelBooking(@Param('id') id: string) {
    return this.bookingsService.cancelBooking(id);
  }

  // 6. Add Note
  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() body: { text: string, author: string }) {
    return this.bookingsService.addNote(id, body.text, body.author);
  }

  // 7. Delete Note
  @Delete(':id/notes/:noteId')
  deleteNote(@Param('id') id: string, @Param('noteId') noteId: string) {
    return this.bookingsService.deleteNote(id, Number(noteId));
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('payment-rules') // Base URL: /payment-rules
export class PaymentRulesController {
  constructor(private readonly bookingsService: BookingsService) {}

  // 1. Get Settings (Payment Settings Page)
  @Get()
  getRules() {
    return this.bookingsService.getRules();
  }

  // 2. Save Settings
  @Post()
  saveRules(@Body() dto: UpdatePaymentRulesDto) {
    return this.bookingsService.saveRules(dto);
  }

 
}