import { Injectable } from '@nestjs/common';
import logger from '../../../../common/utils/logger';
import { WhatsAppFacade } from '../whatsapp.facade';
import { BaseWhatsappHandler } from './base-whatsapp.handler';

@Injectable()
export class BookingUpdatedWhatsappHandler extends BaseWhatsappHandler {
  readonly eventName = 'BOOKING_UPDATED';

  constructor(
    private readonly whatsappFacade: WhatsAppFacade,
  ) {
    super();
  }

  /**
   * Template: booking_updated_v1
   *
   * body_1 -> bookingId
   * body_2 -> eventName
   * body_3 -> oldDateTime
   * body_4 -> newDateTime
   */
  async handle(data: {
    bookingId: string;
    eventName: string;
    oldDateTime: string;
    newDateTime: string;
    mobile?: string | number;
    userId: string;
    userName: string
  }) {

    console.log("booking update whats app data", data)
    if (!data.mobile) {
      logger.warn(
        `⚠️ [WhatsApp] BOOKING_UPDATED: Mobile missing | bookingId=${data.bookingId}`,
      );
      return;
    }

    const to = String(data.mobile);

    await this.whatsappFacade.sendTemplateMessage({
      to,
      template: 'booking_updated_v1',
      language: 'en',
      namespace: 'ea16c768_3401_4afe_aaa3_34759654ba31',

      variables: [
        data.userName ?? 'Customer',          // body_1
        data.bookingId,                           // body_2
        data.eventName,                           // body_3
        `Date changed to ${data.newDateTime}`,    // body_4
      ],
    });

  }
}
