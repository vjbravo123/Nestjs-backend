import { Injectable } from '@nestjs/common';
import logger from '../../../../common/utils/logger';
import { WhatsAppFacade } from '../whatsapp.facade';
import { BaseWhatsappHandler } from './base-whatsapp.handler';

@Injectable()
export class BookingCompletedWhatsappHandler extends BaseWhatsappHandler {
    readonly eventName = 'BOOKING_COMPLETED';

    constructor(
        private readonly whatsappFacade: WhatsAppFacade,
    ) {
        super();
    }

    /**
     * Template: zappy_booking_completed
     *
     * Variables:
     * {{1}} -> bookingId
     * {{2}} -> eventName
     * {{3}} -> eventDateTime
     * {{4}} -> venue
     */
    async handle(data: {
        bookingId: string;
        eventName: string;
        eventDateTime: string;
        venue: string;
        mobile?: string | number;
        userId: string;
    }) {
        if (!data.mobile) {
            logger.warn(
                `⚠️ [WhatsApp] BOOKING_COMPLETED: Mobile missing | bookingId=${data.bookingId}`,
            );
            return;
        }

        const to = String(data.mobile);

        await this.whatsappFacade.sendTemplateMessage({
            to,
            template: 'zappy_booking_completed',
            language: 'en',
            namespace: 'ea16c768_3401_4afe_aaa3_34759654ba31',
            variables: [
                data.bookingId,
                data.eventName,
                data.eventDateTime,
                data.venue,
            ],
            meta: {
                type: 'BOOKING_COMPLETED',
                contactId: data.userId,
                dedupeKey: `BOOKING_COMPLETED:${data.bookingId}`,
                source: 'booking',
                timestamp: new Date().toISOString(),
            },
        });
    }
}
