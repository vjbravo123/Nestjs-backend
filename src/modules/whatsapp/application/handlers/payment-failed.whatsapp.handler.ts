import { Injectable } from '@nestjs/common';
import logger from '../../../../common/utils/logger';
import { WhatsAppFacade } from '../../../../modules/whatsapp/application/whatsapp.facade';

@Injectable()
export class PaymentFailedWhatsappHandler {
    constructor(
        private readonly whatsappFacade: WhatsAppFacade,
    ) { }

    /**
     * Template: zappy_payment_failed
     *
     * Variables:
     * {{1}} -> bookingId
     * {{2}} -> transactionId
     * {{3}} -> amount
     * {{4}} -> status
     */
    async handle(data: {
        bookingId: string;
        transactionId: string;
        amount: number;
        mobile?: string | number;
        userId: string;
    }) {
        if (!data.mobile) {
            logger.warn(
                `⚠️ [WhatsApp] PAYMENT_FAILED: Mobile missing | bookingId=${data.bookingId}`,
            );
            return;
        }

        const to = String(data.mobile);

        logger.info(
            `💬 [WhatsApp] Queueing PAYMENT_FAILED | bookingId=${data.bookingId}`,
        );

        await this.whatsappFacade.sendTemplateMessage({
            to,
            template: 'zappy_payment_failed',
            language: 'en',
            namespace: 'ea16c768_3401_4afe_aaa3_34759654ba31',
            variables: [
                data.bookingId,
                data.transactionId,
                String(data.amount),
                'Failed',
            ],
            meta: {
                type: 'PAYMENT_FAILED',
                contactId: data.userId,
                dedupeKey: `PAYMENT_FAILED:${data.transactionId}`,
                source: 'payment',
                timestamp: new Date().toISOString(),
            },
        });
    }
}
