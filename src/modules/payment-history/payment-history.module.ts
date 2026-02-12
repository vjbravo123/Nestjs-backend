import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentHistory, PaymentHistorySchema } from './payment-history.schema';
import { PaymentHistoryService } from './payment-history.service';
import { PaymentHistoryController } from './payment-history.controller';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: PaymentHistory.name, schema: PaymentHistorySchema }]),
    ],
    controllers: [PaymentHistoryController],
    providers: [PaymentHistoryService],
    exports: [PaymentHistoryService],
})
export class PaymentHistoryModule {}