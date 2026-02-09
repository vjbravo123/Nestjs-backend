import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../../modules/email/email.service';
import logger from '../../common/utils/logger';

type EmailHandler = (data: any) => Promise<void>;

@Injectable()
export class NotificationEmailEventsListener {
    private readonly handlers: Record<string, EmailHandler>;

    constructor(
        private readonly emailService: EmailService,
    ) {
        this.handlers = {
            ORDER_CREATED: this.handleOrderCreated.bind(this),
            ORDER_COMPLETED: this.handleOrderCompleted.bind(this),
            PAYMENT_REFUND: this.handlePaymentRefund.bind(this),
            USER_REGISTERED: this.handleUserRegistered.bind(this),
            PARTNER_APPLICATION_RECEIVED: this.handlePartnerApplicationReceived.bind(this),
            VENDOR_REGISTERED: this.handleVendorRegistered.bind(this),
            BOOKING_CONFIRMED: this.handleBookingConfirmed.bind(this),
            BOOKING_UPDATED: this.handleBookingUpdated.bind(this),
            BOOKING_CANCELLED: this.handleBookingCancelled.bind(this),
            BOOKING_COMPLETED: this.handleBookingCompleted.bind(this),
            PAYMENT_SUCCESSFUL: this.handlePaymentSuccessful.bind(this),
            PAYMENT_FAILED: this.handlePaymentFailed.bind(this),

            // USER_LOGGED_IN: this.handleUserLoggedIn.bind(this),
        };
    }

    @OnEvent('alert.send', { async: true })
    async handleEmailAlert(payload: {
        event: string;
        channels: string[];
        data: any;
    }) {
        if (!payload.channels.includes('email')) return;

        const handler = this.handlers[payload.event];

        if (!handler) {
            logger.warn(
                `⚠️ [Email] No handler found for event ${payload.event}`,
            );
            return;
        }

        logger.info(`📧 [Email] Processing event ${payload.event}`);
        await handler(payload.data);
    }

    // ======================
    // Event-specific handlers
    // ======================

    private async handleOrderCreated(data: any) {
        await this.emailService.sendOrderSuccessEmail(data.email, {
            name: data.name,
            orderId: data.orderId,
            amount: data.amount,
        });
    }

    private async handleOrderCompleted(data: any) {
        await this.emailService.sendOrderSuccessEmail(data.email, {
            orderId: data.orderId,
            amount: data.amount,
        });
    }

    private async handlePaymentRefund(data: any) {
        await this.emailService.sendRefundEmail(data.email, {
            refundId: data.refundId,
            amount: data.amount,
        });
    }

    private async handleUserRegistered(data: any) {
        console.log("print payload dta in console in email listener ", data)
        await this.emailService.sendWelcomeEmail(data.email, data);
    }

    private async handlePartnerApplicationReceived(data: {
        businessName: string;
        partnerEmail: string;
        partnerPhone?: number;
        businessType?: string;
        city?: string;
        appliedDate: Date;
    }) {
        await this.emailService.sendPartnerApplicationReceivedEmail({
            businessName: data.businessName,
            partnerEmail: data.partnerEmail,
            partnerPhone: data.partnerPhone,
            businessType: data.businessType,
            city: data.city,
            appliedDate: data.appliedDate,
        });
    }



    private async handleVendorRegistered(data: {
        partnerName: string;
        partnerEmail: string;
        partnerPhone?: number;
        registerDate: Date;
    }) {
        await this.emailService.sendPartnerWelcomeEmail(
            data.partnerEmail,
            {
                partnerName: data.partnerName,
                partnerEmail: data.partnerEmail,
                partnerPhone: data.partnerPhone,
                registerDate: data.registerDate,
            },
        );
    }

    private async handleBookingConfirmed(data: {
        email: string;
        userName: string;
        bookingDetails: Array<{
            bookingId: string;
            eventName?: string;
            eventDateTime?: string;
            venue?: string;
            amount: number;
            paymentStatus: string;
        }>;
    }) {
        await this.emailService.sendBookingConfirmedEmail(data.email, {
            userName: data.userName,
            bookingDetails: data.bookingDetails,
        });
    }


    private async handleBookingUpdated(data: {
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
    }) {
        await this.emailService.sendBookingUpdatedEmail(data.email, {
            bookingId: data.bookingId,
            eventName: data.eventName,
            eventDateTime: data.eventDateTime,
            venue: data.venue,
            partnerName: data.partnerName,
            bookingStatus: data.bookingStatus,
            oldDateTime: data.oldDateTime,
            newDateTime: data.newDateTime,
            oldVenue: data.oldVenue,
            newVenue: data.newVenue,
            oldAmount: data.oldAmount,
            newAmount: data.newAmount,
        });
    }


    private async handleBookingCancelled(data: {
        bookingId: string;
        eventName: string;
        eventDateTime: string;
        venue: string;
        partnerName: string;
        email: string;
    }) {
        await this.emailService.sendBookingCancelledEmail(data.email, {
            bookingId: data.bookingId,
            eventName: data.eventName,
            eventDateTime: data.eventDateTime,
            venue: data.venue,
            partnerName: data.partnerName,
            status: 'Cancelled',
        });
    }


    private async handleBookingCompleted(data: {
        bookingId: string;
        eventName: string;
        eventDateTime: string;
        venue: string;
        amount: number;
        paid: string;
        email: string;
    }) {
        await this.emailService.sendBookingCompletedEmail(data.email, {
            bookingId: data.bookingId,
            eventName: data.eventName,
            eventDateTime: data.eventDateTime,
            venue: data.venue,
            amount: data.amount,
            paid: data.paid,
        });
    }


    private async handlePaymentSuccessful(data: {
        transactionId: string;
        bookingId: string;
        paymentDate: string;
        paymentMethod: string;
        amount: number;
        email: string;
    }) {
        await this.emailService.sendPaymentSuccessfulEmail(data.email, {
            transactionId: data.transactionId,
            bookingId: data.bookingId,
            paymentDate: data.paymentDate,
            paymentMethod: data.paymentMethod,
            amount: data.amount,
            status: 'Successful',
        });
    }

    private async handlePaymentFailed(data: {
        transactionId: string;
        bookingId: string;
        amount: number;
        email: string;
    }) {
        await this.emailService.sendPaymentFailedEmail(data.email, {
            bookingId: data.bookingId,
            transactionId: data.transactionId,
            amount: data.amount,
            status: 'Failed',
        });
    }



    // private async handleUserLoggedIn(data: any) {
    //     await this.emailService.sendLoginAlertEmail(data.email, data);
    // }
}
