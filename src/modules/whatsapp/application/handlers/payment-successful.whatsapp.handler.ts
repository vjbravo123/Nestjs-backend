import { Injectable } from '@nestjs/common';
import logger from '../../../../common/utils/logger';
import { WhatsAppFacade } from '../../../../modules/whatsapp/application/whatsapp.facade';

@Injectable()
export class PaymentSuccessfulWhatsappHandler {
  constructor(
    private readonly whatsappFacade: WhatsAppFacade,
  ) {}

  /**
   * Template: zappy_payment_successful
   *
   * Variables:
   * {{1}} -> transactionId
   * {{2}} -> bookingId
   * {{3}} -> paymentDate
   * {{4}} -> paymentMethod
   * {{5}} -> amount
   * {{6}} -> paymentStatus
   */
  async handle(data: {
    transactionId: string;
    bookingId: string;
    paymentDate: string;
    paymentMethod: string;
    amount: number;
    mobile?: string | number;
    userId: string;
  }) {
    if (!data.mobile) {
      logger.warn(
        `⚠️ [WhatsApp] PAYMENT_SUCCESSFUL: Mobile missing | bookingId=${data.bookingId}`,
      );
      return;
    }

    const to = String(data.mobile);

    logger.info(
      `💬 [WhatsApp] Queueing PAYMENT_SUCCESSFUL | bookingId=${data.bookingId}`,
    );

    await this.whatsappFacade.sendTemplateMessage({
      to,
      template: 'zappy_payment_successful',
      language: 'en',
      namespace: 'ea16c768_3401_4afe_aaa3_34759654ba31',
      variables: [
        data.transactionId,
        data.bookingId,
        data.paymentDate,
        data.paymentMethod,
        String(data.amount),
        'Successful',
      ],
      meta: {
        type: 'PAYMENT_SUCCESSFUL',
        contactId: data.userId,
        dedupeKey: `PAYMENT_SUCCESSFUL:${data.transactionId}`,
        source: 'payment',
        timestamp: new Date().toISOString(),
      },
    });

    logger.info(
      `✅ [WhatsApp] PAYMENT_SUCCESSFUL queued | transactionId=${data.transactionId}`,
    );
  }
}
