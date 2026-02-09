import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Types } from 'mongoose';

import {
    PAYMENT_EVENTS,
    PaymentSuccessEvent,
} from '../events/payment.events';
import { OrderService } from '../../order/order.service';

@Injectable()
export class PaymentSuccessListener {
    private readonly logger = new Logger(PaymentSuccessListener.name);

    constructor(
        private readonly orderService: OrderService,
    ) { }

    /**
     * 🔥 Fired ONLY after PhonePe webhook confirms SUCCESS
     */
    /**
     * 🔥 Fired ONLY after PhonePe webhook confirms SUCCESS
     */
    @OnEvent(PAYMENT_EVENTS.SUCCESS)
    async handlePaymentSuccess(
        event: PaymentSuccessEvent,
    ) {
        this.logger.log(
            `Payment SUCCESS event received | paymentId=${event.paymentId} | intent=${event.checkoutIntentId}`,
        );

        if (!event.checkoutIntentId) {
            this.logger.error(
                'Missing checkoutIntentId in PaymentSuccessEvent',
            );
            return;
        }

        try {
            await this.orderService.createOrderFromCheckoutIntent(
                event.checkoutIntentId, // ✅ already ObjectId
                event.paymentId.toString(),        // ✅ keep ObjectId
            );

            this.logger.log(
                `Order created from checkoutIntent=${event.checkoutIntentId}`,
            );
        } catch (err) {
            this.logger.error(
                `❌ Failed to create order for checkoutIntent=${event.checkoutIntentId}`,
                err instanceof Error ? err.stack : undefined,
            );

            // OPTIONAL: rethrow if you want global retry / alerting
            throw err;
        }
    }

}
