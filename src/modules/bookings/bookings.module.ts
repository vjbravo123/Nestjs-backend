import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsController, PaymentRulesController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { PaymentRule, PaymentRuleSchema } from './schemas/payment-rule.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: PaymentRule.name, schema: PaymentRuleSchema },
    ]),
  ],
  controllers: [BookingsController, PaymentRulesController],
  providers: [BookingsService],
  exports: [BookingsService], 
})
export class BookingsModule {}