import { Injectable } from '@nestjs/common';
import { EmailQueue } from './queue/email.queue';
import { EmailTemplate } from '../../providers/queue/queue.types';

@Injectable()
export class EmailService {
  constructor(private readonly emailQueue: EmailQueue) { }

  async sendWelcomeEmail(to: string, payload: Record<string, any>) {
    console.log('📥 Adding email job to queue', to);

    const finalPayload = {
      ...payload,
      userName: payload.userName ?? payload.name ?? 'User', // ✅ fix here
    };

    return this.emailQueue.sendEmail({
      to,
      template: 'welcome',
      payload: finalPayload,
    });
  }

  async sendOrderSuccessEmail(to: string, payload: Record<string, any>) {
    return this.emailQueue.sendEmail({
      to,
      template: 'order-success',
      payload,
    });
  }

  async sendRefundEmail(to: string, payload: Record<string, any>) {
    return this.emailQueue.sendEmail({
      to,
      template: 'refund',
      payload,
    });
  }

  async sendCustomEmail(
    to: string | string[],
    template: EmailTemplate,
    payload: Record<string, any>,
  ) {
    return this.emailQueue.sendEmail({
      to,
      template,
      payload,
    });
  }

  /**
  * ----------------------------------------
  * CONTACT US → ADMIN ALERT EMAIL
  * ----------------------------------------
  */
  async sendContactUsAlertEmail(payload: {
    contactId: string;
    fullName: string;
    email: string;
    mobile: string;
    city?: string;
    message?: string;
    createdAt?: string;
  }) {
    return this.emailQueue.sendEmail({
      to: 'support@zappyeventz.com', // ✅ ADMIN EMAIL
      template: 'contact-us-alert',
      payload: {
        contactId: payload.contactId,
        fullName: payload.fullName,
        email: payload.email,
        mobile: payload.mobile,
        city: payload.city || '-',
        message: payload.message || '-',
        createdAt: payload.createdAt || new Date().toISOString(),
      },
    });
  }

  async sendPartnerApplicationReceivedEmail(
    payload: {
      businessName: string;
      partnerEmail: string;
      partnerPhone?: number;
      businessType?: string;
      city?: string;
      appliedDate: Date;
    },
  ) {
    return this.emailQueue.sendEmail({
      to: 'support@zappyeventz.com', // admin email
      template: 'partner-application-received',
      payload,
    });
  }
  async sendPartnerWelcomeEmail(
    to: string,
    payload: {
      partnerName: string;
      partnerEmail: string;
      partnerPhone?: number;
      registerDate: Date;
    },
  ) {
    return this.emailQueue.sendEmail({
      to,
      template: 'partner-welcome',
      payload,
    });
  }


  async sendBookingConfirmedEmail(
    to: string,
    payload: {
      userName: string;
      bookingDetails: Array<{
        bookingId: string;
        eventName?: string;
        eventDateTime?: string;
        venue?: string;
        amount: number;
        paymentStatus: string;
      }>;
    },
  ) {
    return this.emailQueue.sendEmail({
      to,
      template: 'booking-confirmed',
      payload,
    });
  }


  async sendBookingUpdatedEmail(to: string, payload: any) {
    return this.emailQueue.sendEmail({
      to,
      template: 'booking-updated',
      payload,
    });
  }

  async sendBookingCancelledEmail(to: string, payload: any) {
    return this.emailQueue.sendEmail({
      to,
      template: 'booking-cancelled',
      payload,
    });
  }

  async sendBookingCompletedEmail(to: string, payload: any) {
    return this.emailQueue.sendEmail({
      to,
      template: 'booking-completed',
      payload,
    });
  }

  async sendPaymentSuccessfulEmail(to: string, payload: any) {
    return this.emailQueue.sendEmail({
      to,
      template: 'payment-successful',
      payload,
    });
  }

  async sendPaymentFailedEmail(to: string, payload: any) {
    return this.emailQueue.sendEmail({
      to,
      template: 'payment-failed',
      payload,
    });
  }

}
