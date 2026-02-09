import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './entities/payment.schema';
import { PhonePeGateway } from './gateways/phonepe.gateway';
import { PhonePeWebhookController } from './webhooks/phonepe.webhook.controller';
import { CheckoutIntent, CheckoutIntentSchema } from '../checkout/checkout-intent.schema';
import { OrderModule } from '../order/order.module';
@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Payment.name, schema: PaymentSchema },
            { name: CheckoutIntent.name, schema: CheckoutIntentSchema },
        ]),
        ConfigModule,
        OrderModule,
    ],
    controllers: [
        PaymentsController,
        PhonePeWebhookController,
    ],
    providers: [
        PaymentsService,
        PhonePeGateway,
    ],
    exports: [
        PaymentsService,
        PhonePeGateway,
    ],
})
export class PaymentsModule { }
