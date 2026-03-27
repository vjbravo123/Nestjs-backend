import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VendorBooking, VendorBookingDocument } from '../vendor-bookings/vendor-booking.schema';
import { User, UserDocument } from '../../users/users.schema';
import { uploadImageToS3 } from '../../../common/utils/s3-upload.util';
import Redis from 'ioredis';

interface ITracking {
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
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  async getTrackingStatus(bookingId: string, vendorId: string) {
    const booking = await this.bookingModel.findOne({ 
      _id: new Types.ObjectId(bookingId), 
      vendorId: new Types.ObjectId(vendorId) 
    }) as any; 

    if (!booking) throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);

    let step = "ARRIVED_BTN";
    const tracking: ITracking = booking.tracking || {};

    if (tracking.arrivedAt) step = "UPLOAD_ARRIVAL";
    if (tracking.arrivalPhotos && tracking.arrivalPhotos.length > 0) step = "START_OTP";
    if (booking.status === 'in_progress') step = "LIVE";
    if (booking.status === 'in_progress' && tracking.completionPhotos && tracking.completionPhotos.length > 0) step = "END_OTP";
    if (booking.status === 'completed') step = "COMPLETED";

    return { step, booking };
  }

  async markArrival(bookingId: string, vendorId: string) {
    return this.bookingModel.findOneAndUpdate(
      { _id: new Types.ObjectId(bookingId), vendorId: new Types.ObjectId(vendorId) },
      { $set: { 'tracking.arrivedAt': new Date() } },
      { new: true }
    );
  }

  async uploadPhotos(bookingId: string, vendorId: string, files: Express.Multer.File[], type: 'arrival' | 'completion') {
    const uploadPromises = files.map((file) => 
      uploadImageToS3({
        fileBuffer: file.buffer,
        key: `tracking/${bookingId}/${type}/${Date.now()}-${file.originalname}`,
        contentType: file.mimetype
      })
    );

    const urls = await Promise.all(uploadPromises);
    const field = type === 'arrival' ? 'tracking.arrivalPhotos' : 'tracking.completionPhotos';

    // Use a record type to allow dynamic string keys in the update object
    const updateQuery: Record<string, any> = {
      $push: { [field]: { $each: urls } }
    };

    await this.bookingModel.updateOne(
      { _id: new Types.ObjectId(bookingId), vendorId: new Types.ObjectId(vendorId) },
      updateQuery
    );

    return urls;
  }

  async sendOtp(bookingId: string, vendorId: string) {
    // Explicitly type the populated booking
    const booking = await this.bookingModel
      .findOne({ _id: new Types.ObjectId(bookingId), vendorId: new Types.ObjectId(vendorId) })
      .populate<{ userId: UserDocument }>('userId');

    if (!booking) throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    
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
    const storedOtp = await this.redisClient.get(`TRACKING_OTP:${bookingId}`);
    
    if (!storedOtp || storedOtp !== otp) {
      throw new HttpException('Invalid or expired OTP', HttpStatus.BAD_REQUEST);
    }

    await this.redisClient.del(`TRACKING_OTP:${bookingId}`);

    // Use Record<string, any> to allow nested dot notation keys like 'tracking.startedAt'
    const updateData: Record<string, any> = isStart 
      ? { status: 'in_progress', 'tracking.startedAt': new Date() }
      : { status: 'completed', 'tracking.completedAt': new Date() };

    return this.bookingModel.findOneAndUpdate(
      { _id: new Types.ObjectId(bookingId), vendorId: new Types.ObjectId(vendorId) },
      { $set: updateData },
      { new: true }
    );
  }
}