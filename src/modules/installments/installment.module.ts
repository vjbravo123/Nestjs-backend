import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  InstallmentSchedule,
  InstallmentScheduleSchema,
} from './installment.schema';
import { InstallmentService } from './installment.service';
import { InstallmentController } from './installment.controller';
import { BookingPaymentsModule } from '../booking-payments/booking-payments.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: InstallmentSchedule.name,
        schema: InstallmentScheduleSchema,
      },
    ]),
    BookingPaymentsModule,
  ],
  controllers: [InstallmentController],
  providers: [InstallmentService],
  exports: [InstallmentService],
})
export class InstallmentModule { }
