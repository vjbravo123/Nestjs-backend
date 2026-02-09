import { Injectable } from '@nestjs/common';
import logger from '../../../../common/utils/logger';
import { WhatsAppFacade } from '../whatsapp.facade';
import { BaseWhatsappHandler } from './base-whatsapp.handler';

@Injectable()
export class UserRegisteredWhatsappHandler extends BaseWhatsappHandler {
    readonly eventName = 'USER_REGISTERED';

    constructor(
        private readonly whatsappFacade: WhatsAppFacade,
    ) {
        super();
    }

    /**
     * Business intent:
     * Send welcome WhatsApp message when user registers
     *
     * Template: zappy_welcome_users
     * Variables:
     * {{1}} -> user name
     */
    async handle(data: {
        userId: string;
        name: string;
        email: string;
        mobile?: string | number;
        role: 'user' | 'vendor';
    }) {
        if (!data.mobile) {
            logger.warn(
                `⚠️ [WhatsApp] USER_REGISTERED: Mobile missing | userId=${data.userId}`,
            );
            return;
        }

        const to = String(data.mobile);

        logger.info(
            `💬 [WhatsApp] USER_REGISTERED | sending welcome message | to=${to} | userId=${data.userId}`,
        );

        await this.whatsappFacade.sendTemplateMessage({
            // ✅ Generic fields only (provider-agnostic)
            to,
            template: 'zappy_welcome_users',
            language: 'en',
            namespace: 'ea16c768_3401_4afe_aaa3_34759654ba31',

            variables: [
                data.name, // {{1}}
            ],

            // ✅ metadata for logging, dedupe, analytics
            meta: {
                event: 'USER_REGISTERED',
                userId: data.userId,
                role: data.role,
                email: data.email,
                source: 'auth',
                dedupeKey: `USER_REGISTERED:${data.userId}`,
                timestamp: new Date().toISOString(),
            },
        });

        logger.info(
            `✅ [WhatsApp] USER_REGISTERED welcome message queued | userId=${data.userId}`,
        );
    }
}
