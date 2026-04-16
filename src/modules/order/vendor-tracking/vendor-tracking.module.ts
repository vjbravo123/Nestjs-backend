import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { VendorTrackingController } from './vendor-tracking.controller';
import { VendorTrackingService }    from './vendor-tracking.service';

import { VendorBooking, VendorBookingSchema }from '../vendor-bookings/vendor-booking.schema';
import { User, UserSchema } from '../../users/users.schema';
import { Order, OrderSchema } from '../order.schema';
import { BirthdayEvent, BirthdayEventSchema } from 'src/modules/birthdayevent/birthdayevent.schema';
import { ExperientialEvent, ExperientialEventSchema } from 'src/modules/experientialevent/experientialevent.schema';
import { AddOn, AddOnSchema } from 'src/modules/addOn/addon.schema';
import { Msg91Service } from 'src/services/sms.service';
import { RedisModule } from 'src/modules/redis/redis.module';


@Module({
  imports: [
     RedisModule,
    MongooseModule.forFeature([
      { name: VendorBooking.name,     schema: VendorBookingSchema     },
      { name: User.name,              schema: UserSchema              },
      { name: Order.name,             schema: OrderSchema             },
      { name: BirthdayEvent.name,     schema: BirthdayEventSchema     },  
      { name: ExperientialEvent.name, schema: ExperientialEventSchema },  
      { name: AddOn.name,             schema: AddOnSchema            }, 
    ]),
  ],
  controllers: [VendorTrackingController],
   providers: [
    VendorTrackingService,
     Msg91Service,
  ],

})
export class VendorTrackingModule {}