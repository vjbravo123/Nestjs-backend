import { Injectable } from '@nestjs/common';
import logger from '../../../../common/utils/logger';
import { WhatsAppFacade } from '../whatsapp.facade';
import { BaseWhatsappHandler } from './base-whatsapp.handler';

@Injectable()
export class BookingConfirmedWhatsappHandler extends BaseWhatsappHandler {
  readonly eventName = 'BOOKING_CONFIRMED';

  constructor(
    private readonly whatsappFacade: WhatsAppFacade,
  ) {
    super();
  }

  /**
   * MSG91 Template: booking_confirmation_v1
   *
   * {{1}} -> userName
   * {{2}} -> bookingCount
   * {{3}} -> totalAmount
   * {{4}} -> paymentStatus
   * {{5}} -> bookingDetailsUrl
   */
  async handle(data: {
    userName: string;
    mobile?: string | number;
    userId: string;
    bookingSummary: {
      bookingCount: number;
      totalAmount: number;
      paymentStatus: 'PAID' | 'FAILED';
      bookingDetailsUrl: string;
    };
  }) {
    if (!data.mobile) {
      logger.warn(
        `⚠️ [WhatsApp] BOOKING_CONFIRMED: Mobile missing | userId=${data.userId}`,
      );
      return;
    }

    const to = String(data.mobile);

    logger.info(
      `💬 [WhatsApp] Queueing BOOKING_CONFIRMED | to=${to} | bookings=${data.bookingSummary.bookingCount}`,
    );

    await this.whatsappFacade.sendTemplateMessage({
      to,
      template: 'booking_confirmation_v1',
      language: 'en',
      namespace: 'ea16c768_3401_4afe_aaa3_34759654ba31',

      // ✅ THIS MATCHES YOUR FACADE TYPE
      variables: [
        data.userName,                                      // {{1}}
        String(data.bookingSummary.bookingCount),           // {{2}}
        `₹${data.bookingSummary.totalAmount}`,              // {{3}}
        data.bookingSummary.paymentStatus,                  // {{4}}
        data.bookingSummary.bookingDetailsUrl,              // {{5}}
      ],

      meta: {
        type: 'BOOKING_CONFIRMED',
        contactId: data.userId,
        dedupeKey: `BOOKING_CONFIRMED:${data.userId}`, // prevents duplicates
        source: 'booking',
        timestamp: new Date().toISOString(),
      },
    });

    logger.info(
      `✅ [WhatsApp] BOOKING_CONFIRMED queued | userId=${data.userId}`,
    );
  }
}
