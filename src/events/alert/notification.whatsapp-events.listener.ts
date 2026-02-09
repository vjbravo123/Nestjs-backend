import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import logger from '../../common/utils/logger';

import { WhatsappHandlerRegistry } from '../../modules/whatsapp/application/whatsapp-handler.registry';

@Injectable()
export class NotificationWhatsappEventsListener {
    constructor(
        private readonly registry: WhatsappHandlerRegistry,
    ) { }

    @OnEvent('alert.send', { async: true })
    async handleWhatsappAlert(payload: {
        event: string;
        channels: string[];
        data: any;
    }) {
        if (!payload.channels?.includes('whatsapp')) return;

        logger.info(`💬 [WhatsApp] Event received: ${payload.event}`);

        const handler = this.registry.get(payload.event);

        if (!handler) {
            logger.warn(
                `⚠️ [WhatsApp] No handler found for event ${payload.event}`,
            );
            return;
        }

        await handler.handle(payload.data);
    }
}
