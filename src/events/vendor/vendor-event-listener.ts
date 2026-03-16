import { Injectable } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import logger from '../../common/utils/logger';

@Injectable()
export class PartnerEventsListener {
    constructor(
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * PARTNER APPLICATION RECEIVED EVENT (FOR ADMIN)
     */
    @OnEvent('partner.application.received', { async: true })
    async handlePartnerApplicationReceived(payload: {
        partnerId: string;
        name: string;
        email: string;
        mobile?: number;
        businessName?: string;
        city?: string;
    }) {
        logger.info('📩 [Partner] partner.application.received event received');

        // 🔥 Emit alert event for ADMIN
        this.eventEmitter.emit('alert.send', {
            event: 'PARTNER_APPLICATION_RECEIVED',
            channels: ['email', 'whatsapp'],
            data: payload,
        });

        logger.info(
            `✅ [Partner] Alert event emitted for partner application ${payload.partnerId}`,
        );
    }
}
