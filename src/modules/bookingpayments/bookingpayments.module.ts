import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentConfigController } from './bookingpayments.controller';
import { PaymentConfigService } from './payment-config.service';  
import { PaymentConfig, PaymentConfigSchema } from './schemas/payment-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PaymentConfig.name, schema: PaymentConfigSchema }]),
  ],
  controllers: [PaymentConfigController],
  providers: [PaymentConfigService],
  exports: [PaymentConfigService], // Export so BookingService can use it for validations
})
export class BookingpaymentsModule {}