import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Redis from 'ioredis';

import {
  VendorBooking,
  VendorBookingDocument,
} from '../vendor-bookings/vendor-booking.schema';
import { TrackingStatus } from './tracking.enums';
import { User, UserDocument }   from '../../users/users.schema';
import { Order, OrderDocument } from '../order.schema';
import { BirthdayEvent, BirthdayEventDocument } from 'src/modules/birthdayevent/birthdayevent.schema';
import { ExperientialEvent, ExperientialEventDocument } from 'src/modules/experientialevent/experientialevent.schema';
import { AddOn, AddOnDocument } from 'src/modules/addOn/addon.schema';
import { uploadImageToS3 } from '../../../common/utils/s3-upload.util';
import { Msg91Service } from 'src/services/sms.service';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Radius within which a vendor is considered "at the venue" (metres). */
const ARRIVAL_RADIUS_METRES = 200;

/**
 * How early (in minutes before event start) a vendor may press "Arrive".
 * 60 = vendors get a 1-hour window before event time.
 */
const ARRIVAL_EARLY_WINDOW_MINUTES = 60;

/** OTP expiry in seconds (10 minutes). */
const OTP_TTL_SECONDS = 600;

/** Minimum photos required for both arrival and completion steps. */
const MIN_PHOTOS = 2;

/** Fallback duration (minutes) if the source event has no duration set. */
const FALLBACK_DURATION_MINUTES = 0;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class VendorTrackingService {
  constructor(
    @InjectModel(VendorBooking.name)       private bookingModel:        Model<VendorBookingDocument>,
    @InjectModel(User.name)                private userModel:           Model<UserDocument>,
    @InjectModel(Order.name)               private orderModel:          Model<OrderDocument>,
    @InjectModel(BirthdayEvent.name)       private birthdayEventModel:  Model<BirthdayEventDocument>,
    @InjectModel(ExperientialEvent.name)   private experientialModel:   Model<ExperientialEventDocument>,
    @InjectModel(AddOn.name)               private addOnModel:          Model<AddOnDocument>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly msg91Service: Msg91Service,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  //  PRIVATE GUARDS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Asserts the booking's trackingStatus matches the expected value.
   * Throws 409 CONFLICT if the state machine is in the wrong state.
   */
  private assertTrackingStatus(
    booking: VendorBookingDocument,
    expected: TrackingStatus,
  ): void {
    const current: TrackingStatus =
      (booking.trackingStatus as TrackingStatus) ?? TrackingStatus.PENDING;

    if (current !== expected) {
      throw new HttpException(
        `Action not allowed in current tracking state "${current}". Expected "${expected}".`,
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * Mutating tracking actions are only valid ON the event date.
   *  - Past date   → 410 GONE
   *  - Future date → 425 TOO EARLY
   */
  private assertEventDateIsToday(booking: VendorBookingDocument): void {
    const eventDate = booking.eventDate;
    if (!eventDate) return;

    const eventDay = new Date(eventDate);
    eventDay.setUTCHours(0, 0, 0, 0);

    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);

    if (eventDay < todayUtc) {
      throw new HttpException(
        'This booking has expired. The event date has already passed.',
        HttpStatus.GONE,
      );
    }
    if (eventDay > todayUtc) {
      throw new HttpException(
        'Too early. Tracking can only be started on the day of the event.',
        425,
      );
    }
  }

  /**
   * Checks that the current wall-clock time falls within the allowed window.
   * Window: [eventTime − ARRIVAL_EARLY_WINDOW_MINUTES, ∞)
   */
  private assertEventTimeWindow(booking: VendorBookingDocument): void {
    const eventTime: string | undefined = booking.eventTime;
    if (!eventTime) return;

    const [hoursStr, minutesStr] = eventTime.split(':');
    const eventHour   = parseInt(hoursStr,   10);
    const eventMinute = parseInt(minutesStr, 10);

    if (isNaN(eventHour) || isNaN(eventMinute)) return;

    const now            = new Date();
    const eventStartMins = eventHour * 60 + eventMinute;
    const nowMins        = now.getUTCHours() * 60 + now.getUTCMinutes();
    const earliestAllowed = eventStartMins - ARRIVAL_EARLY_WINDOW_MINUTES;

    if (nowMins < earliestAllowed) {
      const diff = earliestAllowed - nowMins;
      throw new HttpException(
        `Too early to mark arrival. You may start ${ARRIVAL_EARLY_WINDOW_MINUTES} minutes ` +
        `before the event. Come back in ${diff} minute(s).`,
        425,
      );
    }
  }

  /**
   * Haversine formula — great-circle distance in metres between two lat/lng pairs.
   */
  private haversineMetres(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
  ): number {
    const R  = 6_371_000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Asserts vendor GPS is within ARRIVAL_RADIUS_METRES of the venue.
   * Throws 422 if out of range, 400 if no location on the linked Order.
   */
  private async assertLocationProximity(
    booking: VendorBookingDocument,
    vendorLat: number,
    vendorLng: number,
  ): Promise<void> {
    const order = await this.orderModel.findById(booking.orderId).lean();

    if (!order?.addressDetails?.latitude || !order?.addressDetails?.longitude) {
      throw new HttpException(
        'Event location is not available for this booking.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const venueLat = Number(order.addressDetails.latitude);
    const venueLng = Number(order.addressDetails.longitude);
    const distance = this.haversineMetres(vendorLat, vendorLng, venueLat, venueLng);

    if (distance > ARRIVAL_RADIUS_METRES) {
      throw new HttpException(
        `You are ${Math.round(distance)} m away from the venue. ` +
        `You must be within ${ARRIVAL_RADIUS_METRES} m to mark arrival.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  /**
   * Asserts that at least 50% of the event duration has elapsed since startedAt.
   * Duration is passed in explicitly — resolved from the source event document.
   */
  private assertHalfDurationElapsed(
    booking: VendorBookingDocument,
    durationMinutes: number,
  ): void {
    const startedAt: Date | undefined = booking.tracking?.startedAt;

    if (!startedAt) {
      throw new HttpException(
        'Event has not been started yet.',
        HttpStatus.CONFLICT,
      );
    }

    const halfwayMs = (durationMinutes / 2) * 60 * 1000;
    const elapsedMs = Date.now() - new Date(startedAt).getTime();

    if (elapsedMs < halfwayMs) {
      const remainingMins = Math.ceil((halfwayMs - elapsedMs) / 60_000);
      throw new HttpException(
        `Completion photos can only be uploaded after at least 50% of the event duration ` +
        `(${durationMinutes / 2} min). Please wait ${remainingMins} more minute(s).`,
        425,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetches the event duration (minutes) from the originating event/addon
   * document, keyed by booking.eventCategory.
   * Falls back to FALLBACK_DURATION_MINUTES if not found.
   */
  private async resolveDuration(
    itemId: Types.ObjectId,
    eventCategory: string,
  ): Promise<number> {
    try {
      let doc: { duration?: number } | null = null;

      if (eventCategory === 'BirthdayEvent') {
        doc = await this.birthdayEventModel
          .findById(itemId)
          .select('duration')
          .lean();

      } else if (eventCategory === 'ExperientialEvent') {
        doc = await this.experientialModel
          .findById(itemId)
          .select('duration')
          .lean();

      } else if (eventCategory === 'AddOn') {
        doc = await this.addOnModel
          .findById(itemId)
          .select('duration')
          .lean();
      }

      return doc?.duration ?? FALLBACK_DURATION_MINUTES;

    } catch {
      return FALLBACK_DURATION_MINUTES;
    }
  }

  /** Shared booking lookup — throws 404 if not found. */
  private async findBooking(
    bookingId: string,
    vendorId: string,
  ): Promise<VendorBookingDocument> {
    const booking = await this.bookingModel.findOne({
      _id:      new Types.ObjectId(bookingId),
      vendorId: new Types.ObjectId(vendorId),
    });

    if (!booking) {
      throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    }
    return booking;
  }

  /** Generates a 6-digit OTP, stores it in Redis, and sends it via Msg91. */
  private async generateAndStoreOtp(
    bookingId: string,
    client: UserDocument,
  ): Promise<void> {
    if (!client?.mobile) {
      throw new HttpException(
        'Client mobile number not found.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const otp = Math.floor(100_000 + Math.random() * 900_000).toString();
    await this.redis.set(`TRACKING_OTP:${bookingId}`, otp, 'EX', OTP_TTL_SECONDS);

    console.log(`[OTP → ${client.mobile}]: ${otp}`);
    await this.msg91Service.sendOtp(client.mobile, otp);
  }

  /** Validates and consumes a stored OTP. Throws 400 on failure. */
  private async validateOtp(
    bookingId: string,
    submittedOtp: string,
  ): Promise<void> {
    const storedOtp = await this.redis.get(`TRACKING_OTP:${bookingId}`);

    if (!storedOtp || storedOtp !== submittedOtp) {
      throw new HttpException('Invalid or expired OTP.', HttpStatus.BAD_REQUEST);
    }

    await this.redis.del(`TRACKING_OTP:${bookingId}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PUBLIC SERVICE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── READ: get status ─────────────────────────────────────────────────────

  async getTrackingStatus(bookingId: string, vendorId: string) {
    const booking = await this.findBooking(bookingId, vendorId);
    return {
      trackingStatus: (booking.trackingStatus as TrackingStatus) ?? TrackingStatus.PENDING,
    };
  }

  // ─── STEP 1: Mark arrival ─────────────────────────────────────────────────
  /**
   * Guards (in order):
   *  1. trackingStatus === PENDING
   *  2. Event date is today
   *  3. Current time is within the arrival window (≤ 60 min before event)
   *  4. Vendor GPS is ≤ 200 m from venue
   *
   * Result: trackingStatus → ARRIVED, tracking.arrivedAt set.
   */
  async markArrival(
    bookingId: string,
    vendorId:  string,
    vendorLat: number,
    vendorLng: number,
  ) {
    const booking = await this.findBooking(bookingId, vendorId);

    this.assertTrackingStatus(booking, TrackingStatus.PENDING);
    this.assertEventDateIsToday(booking);
    this.assertEventTimeWindow(booking);
    await this.assertLocationProximity(booking, vendorLat, vendorLng);

    await this.bookingModel.updateOne(
      { _id: new Types.ObjectId(bookingId), vendorId: new Types.ObjectId(vendorId) },
      {
        $set: {
          trackingStatus:       TrackingStatus.ARRIVED,
          'tracking.arrivedAt': new Date(),
        },
      },
    );

    return { message: 'Arrival marked successfully.' };
  }

  // ─── STEP 2: Upload arrival photos ────────────────────────────────────────
  /**
   * Guards:
   *  1. trackingStatus === ARRIVED
   *  2. ≥ MIN_PHOTOS files provided
   *
   * Result: trackingStatus → ARRIVAL_PHOTOS_UPLOADED.
   */
  async uploadArrivalPhotos(
    bookingId: string,
    vendorId:  string,
    files:     Express.Multer.File[],
  ) {
    const booking = await this.findBooking(bookingId, vendorId);

    this.assertTrackingStatus(booking, TrackingStatus.ARRIVED);

    if (!files || files.length < MIN_PHOTOS) {
      throw new HttpException(
        `Minimum ${MIN_PHOTOS} photos are required for arrival evidence.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const urls = await Promise.all(
      files.map((file) =>
        uploadImageToS3({
          fileBuffer:  file.buffer,
          key:         `tracking/${bookingId}/arrival/${Date.now()}-${file.originalname}`,
          contentType: file.mimetype,
        }),
      ),
    );

    await this.bookingModel.updateOne(
      { _id: new Types.ObjectId(bookingId), vendorId: new Types.ObjectId(vendorId) },
      {
        $set:  { trackingStatus: TrackingStatus.ARRIVAL_PHOTOS_UPLOADED },
        $push: { 'tracking.arrivalPhotos': { $each: urls } },
      },
    );

    return {
      message:       'Arrival photos uploaded successfully.',
      uploadedCount: urls.length,
      photos:        urls,
    };
  }

  // ─── STEP 3a: Send start OTP ──────────────────────────────────────────────
  /**
   * Guards:
   *  1. trackingStatus === ARRIVAL_PHOTOS_UPLOADED
   *  2. Event date is today
   *
   * Result: trackingStatus → START_OTP_SENT.
   */
  async sendStartOtp(bookingId: string, vendorId: string) {
    const booking = await this.bookingModel
      .findOne({
        _id:      new Types.ObjectId(bookingId),
        vendorId: new Types.ObjectId(vendorId),
      })
      .populate<{ userId: UserDocument }>('userId');

    if (!booking) {
      throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    }

    this.assertTrackingStatus(booking as any, TrackingStatus.ARRIVAL_PHOTOS_UPLOADED);
    this.assertEventDateIsToday(booking as any);

    await this.generateAndStoreOtp(bookingId, booking.userId as unknown as UserDocument);

    await this.bookingModel.updateOne(
      { _id: new Types.ObjectId(bookingId) },
      { $set: { trackingStatus: TrackingStatus.START_OTP_SENT } },
    );

    return { message: 'Start verification code sent to client.' };
  }

  // ─── STEP 3b: Verify start OTP ────────────────────────────────────────────
  /**
   * Guards:
   *  1. trackingStatus === START_OTP_SENT
   *  2. Event date is today
   *  3. OTP matches stored value
   *
   * Result: trackingStatus → IN_PROGRESS, booking.status → 'in_progress',
   *         tracking.startedAt set.
   */
  async verifyStartOtp(bookingId: string, vendorId: string, otp: string) {
    const booking = await this.findBooking(bookingId, vendorId);

    this.assertTrackingStatus(booking, TrackingStatus.START_OTP_SENT);
    this.assertEventDateIsToday(booking);
    await this.validateOtp(bookingId, otp);

    await this.bookingModel.updateOne(
      { _id: new Types.ObjectId(bookingId), vendorId: new Types.ObjectId(vendorId) },
      {
        $set: {
          trackingStatus:       TrackingStatus.IN_PROGRESS,
          status:               'in_progress',
          'tracking.startedAt': new Date(),
        },
      },
    );

    return { message: 'Event started successfully.' };
  }

  // ─── STEP 4: Upload completion photos ─────────────────────────────────────
  /**
   * Guards:
   *  1. trackingStatus === IN_PROGRESS
   *  2. ≥ 50% of event duration has elapsed since startedAt
   *     (duration resolved from BirthdayEvent / ExperientialEvent / AddOn)
   *  3. ≥ MIN_PHOTOS files provided
   *
   * Result: trackingStatus → COMPLETION_PHOTOS_UPLOADED.
   */
  async uploadCompletionPhotos(
    bookingId: string,
    vendorId:  string,
    files:     Express.Multer.File[],
  ) {
    const booking = await this.findBooking(bookingId, vendorId);

    this.assertTrackingStatus(booking, TrackingStatus.IN_PROGRESS);

    const durationMinutes = await this.resolveDuration(
      booking.itemId,
      booking.eventCategory,
    );

    this.assertHalfDurationElapsed(booking, durationMinutes);

    if (!files || files.length < MIN_PHOTOS) {
      throw new HttpException(
        `Minimum ${MIN_PHOTOS} photos are required for completion evidence.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const urls = await Promise.all(
      files.map((file) =>
        uploadImageToS3({
          fileBuffer:  file.buffer,
          key:         `tracking/${bookingId}/completion/${Date.now()}-${file.originalname}`,
          contentType: file.mimetype,
        }),
      ),
    );

    await this.bookingModel.updateOne(
      { _id: new Types.ObjectId(bookingId), vendorId: new Types.ObjectId(vendorId) },
      {
        $set:  { trackingStatus: TrackingStatus.COMPLETION_PHOTOS_UPLOADED },
        $push: { 'tracking.completionPhotos': { $each: urls } },
      },
    );

    return {
      message:       'Completion photos uploaded successfully.',
      uploadedCount: urls.length,
      photos:        urls,
    };
  }

  // ─── STEP 5a: Send end OTP ────────────────────────────────────────────────
  /**
   * Guards:
   *  1. trackingStatus === COMPLETION_PHOTOS_UPLOADED
   *  2. Event date is today
   *
   * Result: trackingStatus → END_OTP_SENT.
   */
  async sendEndOtp(bookingId: string, vendorId: string) {
    const booking = await this.bookingModel
      .findOne({
        _id:      new Types.ObjectId(bookingId),
        vendorId: new Types.ObjectId(vendorId),
      })
      .populate<{ userId: UserDocument }>('userId');

    if (!booking) {
      throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    }

    this.assertTrackingStatus(booking as any, TrackingStatus.COMPLETION_PHOTOS_UPLOADED);
    this.assertEventDateIsToday(booking as any);

    await this.generateAndStoreOtp(bookingId, booking.userId as unknown as UserDocument);

    await this.bookingModel.updateOne(
      { _id: new Types.ObjectId(bookingId) },
      { $set: { trackingStatus: TrackingStatus.END_OTP_SENT } },
    );

    return { message: 'End verification code sent to client.' };
  }

  // ─── STEP 5b: Verify end OTP ──────────────────────────────────────────────
  /**
   * Guards:
   *  1. trackingStatus === END_OTP_SENT
   *  2. OTP matches stored value
   *  (no date guard — event may have run past midnight)
   *
   * Result: trackingStatus → COMPLETED, booking.status → 'completed',
   *         tracking.completedAt set.
   */
  async verifyEndOtp(bookingId: string, vendorId: string, otp: string) {
    const booking = await this.findBooking(bookingId, vendorId);

    this.assertTrackingStatus(booking, TrackingStatus.END_OTP_SENT);
    await this.validateOtp(bookingId, otp);

    await this.bookingModel.updateOne(
      { _id: new Types.ObjectId(bookingId), vendorId: new Types.ObjectId(vendorId) },
      {
        $set: {
          trackingStatus:         TrackingStatus.COMPLETED,
          status:                 'completed',
          'tracking.completedAt': new Date(),
        },
      },
    );

    return { message: 'Event completed successfully.' };
  }
}