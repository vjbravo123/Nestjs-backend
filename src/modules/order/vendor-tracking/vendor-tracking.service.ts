import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VendorBooking, VendorBookingDocument } from '../vendor-bookings/vendor-booking.schema';
import { User, UserDocument } from '../../users/users.schema';
import { uploadImageToS3 } from '../../../common/utils/s3-upload.util';
import { Order, OrderDocument } from '../order.schema';
import Redis from 'ioredis';

interface ITracking {
  status?: string;
  arrivedAt?: Date;
  arrivalPhotos?: string[];
  startedAt?: Date;
  completionPhotos?: string[];
  completedAt?: Date;
}

@Injectable()
export class VendorTrackingService {
  constructor(
    @InjectModel(VendorBooking.name) private bookingModel: Model<VendorBookingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  // ─── Private guard ────────────────────────────────────────────────────────

  /**
   * Tracking actions (arrive, upload, OTP) are only valid ON the event date.
   * - Past date  → 410 GONE
   * - Future date → 425 TOO EARLY
   * - Already completed booking → always allowed (read/view flows)
   */
  private assertEventDateIsToday(booking: any): void {
    const tracking: ITracking = booking.tracking || {};

    if (tracking.status === 'completed') return;

    const eventDate = booking.eventDate;
    if (!eventDate) return;

    const eventDay = new Date(eventDate);
    eventDay.setUTCHours(0, 0, 0, 0);

    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);

    if (eventDay < todayUtc) {
      throw new HttpException(
        'This booking has expired. The event date has already passed.',
        HttpStatus.GONE, // 410
      );
    }

    if (eventDay > todayUtc) {
      throw new HttpException(
         'Too early. Tracking can only be started on the day of the event.',
    425,
      );
    }
  }

  // ─── Service methods ──────────────────────────────────────────────────────

  async getTrackingStatus(bookingId: string, vendorId: string) {
    const booking = await this.bookingModel.findOne({
      _id: new Types.ObjectId(bookingId),
      vendorId: new Types.ObjectId(vendorId),
    }) as any;

    if (!booking) throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);

    // getStatus is intentionally NOT guarded — vendor must be able to
    // view the booking details on any day (e.g. to check the address).
    // The guard lives only on mutating actions below.

    let step = 'ARRIVED_BTN';
    const tracking: ITracking = booking.tracking || {};

    if (tracking.arrivedAt) step = 'UPLOAD_ARRIVAL';
    if (tracking.arrivalPhotos && tracking.arrivalPhotos.length > 0) step = 'START_OTP';
    if (tracking.status === 'in_progress') step = 'LIVE';
    if (tracking.status === 'in_progress' && tracking.completionPhotos && tracking.completionPhotos.length > 0) step = 'END_OTP';
    if (tracking.status === 'completed') step = 'COMPLETED';

    return { step, booking };
  }

  async markArrival(bookingId: string, vendorId: string) {
  const booking = await this.bookingModel.findOne({
    _id: new Types.ObjectId(bookingId),
    vendorId: new Types.ObjectId(vendorId),
  }) as any;

  if (!booking) throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);

  this.assertEventDateIsToday(booking);

  // ← block if already marked
  if (booking.tracking?.arrivedAt) {
    throw new HttpException('Arrival already marked for this booking.', HttpStatus.CONFLICT); // 409
  }

  return this.bookingModel.findOneAndUpdate(
    { _id: new Types.ObjectId(bookingId), vendorId: new Types.ObjectId(vendorId) },
    { $set: { 'tracking.arrivedAt': new Date() } },
    { new: true },
  );
}

  async uploadPhotos(bookingId: string, vendorId: string, files: Express.Multer.File[], type: 'arrival' | 'completion') {
  const booking = await this.bookingModel.findOne({
    _id: new Types.ObjectId(bookingId),
    vendorId: new Types.ObjectId(vendorId),
  }) as any;

  if (!booking) throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);

  this.assertEventDateIsToday(booking);

  // ← exactly 2 photos required
  if (!files || files.length === 0) {
    throw new HttpException('No images provided.', HttpStatus.BAD_REQUEST);
  }

  if (files.length < 2) {
  throw new HttpException('Minimum 2 photos are required.', HttpStatus.BAD_REQUEST);
}

  // ← block re-upload
  const tracking = booking.tracking || {};
  const existingPhotos = type === 'arrival' ? tracking.arrivalPhotos : tracking.completionPhotos;

  if (existingPhotos && existingPhotos.length > 0) {
    throw new HttpException(
      `${type === 'arrival' ? 'Arrival' : 'Completion'} photos have already been uploaded.`,
      HttpStatus.CONFLICT, // 409
    );
  }

  const uploadPromises = files.map((file) =>
    uploadImageToS3({
      fileBuffer: file.buffer,
      key: `tracking/${bookingId}/${type}/${Date.now()}-${file.originalname}`,
      contentType: file.mimetype,
    }),
  );

  const urls = await Promise.all(uploadPromises);
  const field = type === 'arrival' ? 'tracking.arrivalPhotos' : 'tracking.completionPhotos';

  const updateQuery: Record<string, any> = {
    $push: { [field]: { $each: urls } },
  };

  await this.bookingModel.updateOne(
    { _id: new Types.ObjectId(bookingId), vendorId: new Types.ObjectId(vendorId) },
    updateQuery,
  );

  return {
    message: `${type === 'arrival' ? 'Arrival' : 'Completion'} photos uploaded successfully.`,
    uploadedCount: urls.length,
    photos: urls,
  };
}

  async sendOtp(bookingId: string, vendorId: string) {
    const booking = await this.bookingModel
      .findOne({ _id: new Types.ObjectId(bookingId), vendorId: new Types.ObjectId(vendorId) })
      .populate<{ userId: UserDocument }>('userId') as any;

    if (!booking) throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);

    this.assertEventDateIsToday(booking); // must be event day

    const client = booking.userId;
    if (!client || !client.mobile) {
      throw new HttpException('Client mobile not found', HttpStatus.BAD_REQUEST);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redisClient.set(`TRACKING_OTP:${bookingId}`, otp, 'EX', 600);

    // TODO: msg91Service.sendOtp(client.mobile, otp);
    console.log(`[OTP SENT TO CLIENT ${client.mobile}]: ${otp}`);

    return { message: 'Verification code sent to client' };
  }

  async verifyOtp(bookingId: string, vendorId: string, otp: string, isStart: boolean) {
    const booking = await this.bookingModel.findOne({
      _id: new Types.ObjectId(bookingId),
      vendorId: new Types.ObjectId(vendorId),
    }) as any;

    if (!booking) throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);

    this.assertEventDateIsToday(booking); // must be event day (skipped if completed)

    const storedOtp = await this.redisClient.get(`TRACKING_OTP:${bookingId}`);

    if (!storedOtp || storedOtp !== otp) {
      throw new HttpException('Invalid or expired OTP', HttpStatus.BAD_REQUEST);
    }

    await this.redisClient.del(`TRACKING_OTP:${bookingId}`);

    const updateData: Record<string, any> = isStart
      ? { 'tracking.status': 'in_progress', 'tracking.startedAt': new Date() }
      : { 'tracking.status': 'completed', 'tracking.completedAt': new Date() };

    return this.bookingModel.findOneAndUpdate(
      { _id: new Types.ObjectId(bookingId), vendorId: new Types.ObjectId(vendorId) },
      { $set: updateData },
      { new: true },
    );
  }

  async getOrderLocation(bookingId: string, vendorId: string) {
    const booking = await this.bookingModel.findOne({
      _id: new Types.ObjectId(bookingId),
      vendorId: new Types.ObjectId(vendorId),
    }) as any;

    if (!booking) throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);

    const order = await this.orderModel.findById(booking.orderId);

    if (!order || !order.addressDetails) {
      throw new HttpException('Location not found', HttpStatus.NOT_FOUND);
    }

    return {
      latitude: order.addressDetails.latitude,
      longitude: order.addressDetails.longitude,
      address: order.addressDetails.address,
      city: order.addressDetails.city,
      state: order.addressDetails.state,
    };
  }
}