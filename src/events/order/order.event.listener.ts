import { Injectable } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import logger from '../../common/utils/logger';

@Injectable()
export class OrderEventsListener {
    constructor(
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * BOOKING CONFIRMED
     */
    @OnEvent('booking.confirmed', { async: true })
    async handleBookingConfirmed(payload: {
        email: string;
        userName: string;
        mobile?: string;

        bookingSummary: {
            bookingCount: number;
            totalAmount: number;
            paymentStatus: 'PAID' | 'FAILED';
            bookingDetailsUrl: string;
        };

        bookingDetails: Array<{
            bookingId: string;
            eventName?: string;
            eventDateTime?: string;
            venue?: string;
            amount: number;
            paymentStatus: 'PAID' | 'FAILED';

            // optional
            packageName?: string;
            packagePrice?: number;
            packageDescription?: string;
        }>;
    }) {
        logger.info('📩 [Order] booking.confirmed event received');

        logger.info(
            `📦 Bookings=${payload.bookingSummary.bookingCount}, Total=₹${payload.bookingSummary.totalAmount}`,
        );

        this.eventEmitter.emit('alert.send', {
            event: 'BOOKING_CONFIRMED',
            channels: ['email', 'whatsapp'], // WhatsApp intentionally not sent per booking
            data: payload,
        });

        logger.info(
            `✅ [Order] Alert emitted for booking confirmed (${payload.bookingSummary.bookingCount} bookings)`,
        );
    }



    /**
     * BOOKING UPDATED BY ADMIN
     */
    @OnEvent('booking.updated', { async: true })
    async handleBookingUpdated(payload: {
        bookingId: string;
        eventName: string;
        eventDateTime: string;
        venue: string;
        partnerName: string;
        bookingStatus: string;
        oldDateTime?: string;
        newDateTime?: string;
        oldVenue?: string;
        newVenue?: string;
        oldAmount?: number;
        newAmount?: number;
        email: string;
        mobile: string | number
        userName: string
    }) {
        logger.info('📩 [Order] booking.updated event received');

        this.eventEmitter.emit('alert.send', {
            event: 'BOOKING_UPDATED',
            channels: ['email', 'whatsapp'],
            data: payload,
        });

        logger.info(
            `✅ [Order] Alert emitted for booking updated ${payload.bookingId}`,
        );
    }

    /**
     * BOOKING CANCELLED
     */
    @OnEvent('booking.cancelled', { async: true })
    async handleBookingCancelled(payload: {
        bookingId: string;
        eventName: string;
        eventDateTime: string;
        venue: string;
        partnerName: string;
        email: string;
    }) {
        logger.info('📩 [Order] booking.cancelled event received');

        this.eventEmitter.emit('alert.send', {
            event: 'BOOKING_CANCELLED',
            channels: ['email'],
            data: payload,
        });

        logger.info(
            `✅ [Order] Alert emitted for booking cancelled ${payload.bookingId}`,
        );
    }

    /**
     * BOOKING COMPLETED
     */
    @OnEvent('booking.completed', { async: true })
    async handleBookingCompleted(payload: {
        bookingId: string;
        eventName: string;
        eventDateTime: string;
        venue: string;
        amount: number;
        paid: string;
        email: string;
    }) {
        logger.info('📩 [Order] booking.completed event received');

        this.eventEmitter.emit('alert.send', {
            event: 'BOOKING_COMPLETED',
            channels: ['email'],
            data: payload,
        });

        logger.info(
            `✅ [Order] Alert emitted for booking completed ${payload.bookingId}`,
        );
    }
}
