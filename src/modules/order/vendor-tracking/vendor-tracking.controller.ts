import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseInterceptors,
  UploadedFiles,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { VendorTrackingService } from './vendor-tracking.service';
import { VerifyOtpDto } from './dto/tracking-request.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('vendor/tracking')
export class VendorTrackingController {
  constructor(private readonly trackingService: VendorTrackingService) {}

  /**
   * STEP 0: Hydration
   * Fetches the current tracking state of a booking.
   */
  @Get(':bookingId')
  getStatus(@Param('bookingId') bookingId: string, @Req() req: any) {
    // req.user contains vendorId as per your debug data
    return this.trackingService.getTrackingStatus(bookingId, req.user.vendorId);
  }

  /**
   * STEP 1: Arrival Confirmation
   * Records the timestamp when a vendor clicks "I Have Arrived".
   */
  @Post(':bookingId/arrive')
  arrive(@Param('bookingId') bookingId: string, @Req() req: any) {
    return this.trackingService.markArrival(bookingId, req.user.vendorId);
  }

  /**
   * STEP 2: Arrival Evidence
   * Uploads photos of the venue/setup as proof of arrival.
   */
  @Post(':bookingId/upload-arrival')
  @UseInterceptors(FilesInterceptor('images'))
  uploadArrival(
    @Param('bookingId') bookingId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    return this.trackingService.uploadPhotos(
      bookingId,
      req.user.vendorId,
      files,
      'arrival',
    );
  }

  /**
   * STEP 3a: OTP Trigger
   * Generates a code and sends it to the CLIENT'S mobile.
   */
  @Post(':bookingId/request-otp')
  requestOtp(@Param('bookingId') bookingId: string, @Req() req: any) {
    return this.trackingService.sendOtp(bookingId, req.user.vendorId);
  }

  /**
   * STEP 3b: Start Session Verification
   * Validates Start-OTP. Moves booking status to 'in_progress'.
   */
  @Post(':bookingId/verify-start')
  verifyStart(
    @Param('bookingId') bookingId: string,
    @Body() dto: VerifyOtpDto,
    @Req() req: any,
  ) {
    return this.trackingService.verifyOtp(
      bookingId,
      req.user.vendorId,
      dto.otp,
      true,
    );
  }

  /**
   * STEP 4: Completion Evidence
   * Uploads photos of the finished work.
   */
  @Post(':bookingId/upload-completion')
  @UseInterceptors(FilesInterceptor('images'))
  uploadEnd(
    @Param('bookingId') bookingId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    return this.trackingService.uploadPhotos(
      bookingId,
      req.user.vendorId,
      files,
      'completion',
    );
  }

  /**
   * STEP 5: Final Closure Verification
   * Validates End-OTP. Moves booking status to 'completed'.
   */
  @Post(':bookingId/verify-end')
  verifyEnd(
    @Param('bookingId') bookingId: string,
    @Body() dto: VerifyOtpDto,
    @Req() req: any,
  ) {
    return this.trackingService.verifyOtp(
      bookingId,
      req.user.vendorId,
      dto.otp,
      false,
    );
  }

  /**
   * EXTRA STEP: Get event location coordinates
   */
  @Get(':bookingId/location')
  getLocation(@Param('bookingId') bookingId: string, @Req() req: any) {
    return this.trackingService.getOrderLocation(bookingId, req.user.vendorId);
  }
}
