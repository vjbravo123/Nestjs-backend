import { Injectable, Logger } from '@nestjs/common';

import { Types } from 'mongoose';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import logger from '../../common/utils/logger';
import {
    PAYMENT_EVENTS,
    PaymentSuccessEvent,
    PaymentOfflineSelectedEvent
} from '../../modules/payments/events/payment.events';
import { OrderService } from '../../modules/order/order.service';

@Injectable()
export class PaymentSuccessListener {
    private readonly logger = new Logger(PaymentSuccessListener.name);
    constructor(
        private readonly orderService: OrderService,
        private readonly eventEmitter: EventEmitter2,
    ) {
        console.log('🟢 PaymentSuccessListener REGISTERED');
    }

    @OnEvent(PAYMENT_EVENTS.SUCCESS)
    async handle(event: PaymentSuccessEvent) {
        console.log('🎯 PAYMENT SUCCESS EVENT RECEIVED', event);

        if (!event.checkoutIntentId) {
            this.logger.error('Missing checkoutIntentId');
            return;
        }

        await this.orderService.createOrderFromCheckoutIntent(
            new Types.ObjectId(event.checkoutIntentId),
            event.paymentId.toString(),
        );

        this.logger.log(
            `Order created from checkoutIntent=${event.checkoutIntentId}`,
        );
    }

    @OnEvent(PAYMENT_EVENTS.OFFLINE_SELECTED)
    async handleOffline(event: PaymentOfflineSelectedEvent) {

        console.log('🎯 offline PAYMENT SUCCESS EVENT RECEIVED trigger', event);

        if (!event.checkoutIntentId) {
            this.logger.error('Missing checkoutIntentId');
            return;
        }
        await this.orderService.createPendingOrderFromOfflineCheckoutIntent(
            event.checkoutIntentId,
            event.paymentId.toString(),
        );
    }
    /**
     * PAYMENT SUCCESSFUL EVENT
     */
    @OnEvent('payment.successful', { async: true })
    async handlePaymentSuccessful(payload: {
        userId?: string;
        email: string;
        mobile?: number;
        transactionId: string;
        bookingId: string;
        paymentDate: string;
        paymentMethod: string;
        amount: number;
    }) {
        logger.info('📩 [Payment] payment.successful event received');

        // 🔥 Emit alert event
        this.eventEmitter.emit('alert.send', {
            event: 'PAYMENT_SUCCESSFUL',
            channels: ['email', 'whatsapp'],
            data: payload,
        });

        logger.info(
            `✅ [Payment] Alert event emitted for successful payment | transactionId=${payload.transactionId}`,
        );
    }

    /**
     * PAYMENT FAILED EVENT
     */
    @OnEvent('payment.failed', { async: true })
    async handlePaymentFailed(payload: {
        userId: string;
        email: string;
        mobile?: number;
        transactionId: string;
        bookingId: string;
        amount: number;
    }) {
        logger.info('📩 [Payment] payment.failed event received');

        // 🔥 Emit alert event
        this.eventEmitter.emit('alert.send', {
            event: 'PAYMENT_FAILED',
            channels: ['email', 'whatsapp'],
            data: payload,
        });

        logger.info(
            `✅ [Payment] Alert event emitted for failed payment | transactionId=${payload.transactionId}`,
        );
    }



}
