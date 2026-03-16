import { Injectable } from '@nestjs/common';
import { EmailQueue } from './queue/email.queue';
import { EmailTemplate } from '../../providers/queue/queue.types';

@Injectable()
export class EmailService {
  constructor(private readonly emailQueue: EmailQueue) { }

  async sendWelcomeEmail(to: string, payload: Record<string, any>) {
    console.log('📥 Adding welcome email job to queue');

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


  /**
 * ----------------------------------------
 * CUSTOMIZE PACKAGE → ADMIN ALERT EMAIL
 * ----------------------------------------
 */
  async sendCustomizePackageAlertEmail(payload: {
    requestId: string;
    name: string;
    phone: string;
    email?: string;
    guestCount?: number;
    preferredDate?: string;
    budgetRange?: string;
    eventName?: string;
    customizations?: string;
    createdAt?: string;
  }) {
    return this.emailQueue.sendEmail({
      to: 'support@zappyeventz.com', // ✅ ADMIN EMAIL
      template: 'customize-package-alert',
      payload: {
        requestId: payload.requestId,
        name: payload.name,
        phone: payload.phone,
        email: payload.email || '-',
        guestCount: payload.guestCount || '-',
        preferredDate: payload.preferredDate || '-',
        budgetRange: payload.budgetRange || '-',
        eventName: payload.eventName || '-',
        customizations: payload.customizations || '-',
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


  async sendTalkToExpertAlertEmail(payload: {
    requestId: string;
    name: string;
    phone: string;
    contactMethod: string;
    preferredTime: string;
    eventName?: string;
    createdAt?: string;
  }) {

    return this.emailQueue.sendEmail({
      to: 'support@zappyeventz.com',
      template: 'talk-to-expert-alert',
      payload: {
        requestId: payload.requestId,
        name: payload.name,
        phone: payload.phone,
        contactMethod: payload.contactMethod,
        preferredTime: payload.preferredTime,
        eventName: payload.eventName || '-',
        createdAt: payload.createdAt || new Date().toISOString(),
      },
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
