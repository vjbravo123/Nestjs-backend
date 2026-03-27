import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorTrackingController } from './vendor-tracking.controller';
import { VendorTrackingService } from './vendor-tracking.service';
import { VendorBooking, VendorBookingSchema } from '../vendor-bookings/vendor-booking.schema';
import { User, UserSchema } from '../../users/users.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VendorBooking.name, schema: VendorBookingSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [VendorTrackingController],
  providers: [
    VendorTrackingService,
    {
        provide: 'REDIS_CLIENT',
        useFactory: () => {
            return new (require('ioredis'))(process.env.REDIS_URL);
        },
    },
  ],
})
export class VendorTrackingModule {}