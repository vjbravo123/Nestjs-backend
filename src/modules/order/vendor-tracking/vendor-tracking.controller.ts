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
import { ArriveDto, VerifyOtpDto } from './dto/tracking-request.dto';
import { JwtAuthGuard }            from 'src/modules/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('vendor-tracking')
export class VendorTrackingController {
  constructor(private readonly trackingService: VendorTrackingService) {}

  /**
   * GET /vendor/tracking/:bookingId
   * Returns current trackingStatus 
   */
  @Get(':bookingId')
  getStatus(@Param('bookingId') bookingId: string, @Req() req: any) {
    return this.trackingService.getTrackingStatus(bookingId, req.user.vendorId);
  }

  /**
   * POST /vendor/tracking/:bookingId/arrive
   * Body: { latitude: number, longitude: number }
   * Guards: PENDING → date today → GPS proximity
   * Result: ARRIVED
   */
  @Post(':bookingId/arrive')
  arrive(
    @Param('bookingId') bookingId: string,
    @Body() dto: ArriveDto,
    @Req() req: any,
  ) {
    return this.trackingService.markArrival(
      bookingId,
      req.user.vendorId,
      dto.latitude,
      dto.longitude,
    );
  }

  /**
   * POST /vendor/tracking/:bookingId/upload-arrival
   * Form-data key: "images" (min 2 files)
   * Guards: ARRIVED → ≥ 2 images
   * Result: ARRIVAL_PHOTOS_UPLOADED
   */
  @Post(':bookingId/upload-arrival')
  @UseInterceptors(
    FilesInterceptor('images', 2, {
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
    }),
  )
  uploadArrival(
    @Param('bookingId') bookingId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    return this.trackingService.uploadArrivalPhotos(
      bookingId,
      req.user.vendorId,
      files,
    );
  }

  /**
   * POST /vendor/tracking/:bookingId/request-start-otp
   * Guards: ARRIVAL_PHOTOS_UPLOADED → date today
   * Result: START_OTP_SENT (OTP sent to client mobile)
   */
  @Post(':bookingId/request-start-otp')
  requestStartOtp(@Param('bookingId') bookingId: string, @Req() req: any) {
    return this.trackingService.sendStartOtp(bookingId, req.user.vendorId);
  }

  /**
   * POST /vendor/tracking/:bookingId/verify-start
   * Body: { otp: string }
   * Guards: START_OTP_SENT → date today → OTP valid
   * Result: IN_PROGRESS, booking.status = 'in_progress'
   */
  @Post(':bookingId/verify-start')
  verifyStart(
    @Param('bookingId') bookingId: string,
    @Body() dto: VerifyOtpDto,
    @Req() req: any,
  ) {
    return this.trackingService.verifyStartOtp(
      bookingId,
      req.user.vendorId,
      dto.otp,
    );
  }

  /**
   * POST /vendor/tracking/:bookingId/upload-completion
   * Form-data key: "images" (min 2 files)
   * Guards: IN_PROGRESS → ≥50% duration elapsed → ≥ 2 images
   * Result: COMPLETION_PHOTOS_UPLOADED
   */
  @Post(':bookingId/upload-completion')
  @UseInterceptors(
    FilesInterceptor('images', 2, {
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
    }),
  )
  uploadCompletion(
    @Param('bookingId') bookingId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    return this.trackingService.uploadCompletionPhotos(
      bookingId,
      req.user.vendorId,
      files,
    );
  }

  /**
   * POST /vendor/tracking/:bookingId/request-end-otp
   * Guards: COMPLETION_PHOTOS_UPLOADED → date today
   * Result: END_OTP_SENT (OTP sent to client mobile)
   */
  @Post(':bookingId/request-end-otp')
  requestEndOtp(@Param('bookingId') bookingId: string, @Req() req: any) {
    return this.trackingService.sendEndOtp(bookingId, req.user.vendorId);
  }

  /**
   * POST /vendor/tracking/:bookingId/verify-end
   * Body: { otp: string }
   * Guards: END_OTP_SENT → OTP valid
   * Result: COMPLETED, booking.status = 'completed'
   */
  @Post(':bookingId/verify-end')
  verifyEnd(
    @Param('bookingId') bookingId: string,
    @Body() dto: VerifyOtpDto,
    @Req() req: any,
  ) {
    return this.trackingService.verifyEndOtp(
      bookingId,
      req.user.vendorId,
      dto.otp,
    );
  }
}