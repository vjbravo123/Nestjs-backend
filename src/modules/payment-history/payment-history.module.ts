import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentHistoryController } from './payment-history.controller';
import { PaymentHistoryService } from './payment-history.service';
import { PaymentHistory, PaymentHistorySchema } from './payment-history.schema';
import { PaymentRulesModule } from '../payment-rules/payment-rules.module'; 

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PaymentHistory.name, schema: PaymentHistorySchema }]),
    PaymentRulesModule 
  ],
  controllers: [PaymentHistoryController],
  providers: [PaymentHistoryService],
})
export class PaymentHistoryModule {}