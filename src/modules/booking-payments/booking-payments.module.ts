import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentConfigController } from './booking-payments.controller';
import { PaymentConfigService } from './payment-config.service';
import { PaymentConfig, PaymentConfigSchema } from './schemas/payment-config.schema';
import { PaymentMilestoneController } from './payment-milestone/payment-milestone.controller';
import { PaymentMilestoneService } from './payment-milestone/payment-milestone.service';
import { PaymentMilestone, PaymentMilestoneSchema } from './payment-milestone/payment-milestone.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentConfig.name, schema: PaymentConfigSchema },
      { name: PaymentMilestone.name, schema: PaymentMilestoneSchema },
    ]),
  ],
  controllers: [PaymentConfigController, PaymentMilestoneController],
  providers: [PaymentConfigService, PaymentMilestoneService],
  exports: [PaymentConfigService, PaymentMilestoneService],
})
export class BookingPaymentsModule { }
