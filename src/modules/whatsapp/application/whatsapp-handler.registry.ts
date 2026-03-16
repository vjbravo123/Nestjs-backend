import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { BaseWhatsappHandler } from './handlers/base-whatsapp.handler';
import { WHATSAPP_HANDLERS } from './constants/whatsapp.constants';

@Injectable()
export class WhatsappHandlerRegistry implements OnModuleInit {
    private readonly handlers = new Map<string, BaseWhatsappHandler>();

    constructor(
        @Inject(WHATSAPP_HANDLERS)
        private readonly registeredHandlers: BaseWhatsappHandler[],
    ) { }

    onModuleInit() {
        if (!this.registeredHandlers?.length) {
            throw new Error(
                '[WhatsApp] No WhatsApp handlers registered. Did you forget to provide them?',
            );
        }

        for (const handler of this.registeredHandlers) {
            const event = handler.eventName;

            if (!event) {
                throw new Error(
                    `[WhatsApp] Handler ${handler.constructor.name} is missing eventName`,
                );
            }

            if (this.handlers.has(event)) {
                throw new Error(
                    `[WhatsApp] Duplicate handler detected for event "${event}"`,
                );
            }

            this.handlers.set(event, handler);
        }
    }

    get(eventName: string): BaseWhatsappHandler | undefined {
        return this.handlers.get(eventName);
    }

    getRegisteredEvents(): readonly string[] {
        return Array.from(this.handlers.keys());
    }
}
