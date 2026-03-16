import { Injectable } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import logger from '../../common/utils/logger';

@Injectable()
export class CustomizePackageEventsListener {
    constructor(
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * CUSTOMIZE PACKAGE CREATED EVENT
     */
    @OnEvent('customizepackage.created', { async: true })
    async handleCustomizePackage(payload: {
        requestId: string;
        name: string;
        phone: string;
        email?: string;
        guestCount?: number;
        preferredDate?: string;
        budgetRange?: string;
        eventName?: string;
        customizations?: string[];
        createdAt?: string;
    }) {
        logger.info(
            `🎉 [CustomizePackage] customizepackage.created event received | requestId=${payload.requestId}`,
        );

        logger.debug(
            `[CustomizePackage] Payload | ${JSON.stringify(payload)}`,
        );

        /**
         * 🔥 Emit Alert Event for Admin
         */
        this.eventEmitter.emit('alert.send', {
            event: 'CUSTOMIZE_PACKAGE_REQUEST',
            channels: ['email'],
            data: payload,
        });

        logger.info(
            `✅ [CustomizePackage] Alert event emitted for request ${payload.requestId}`,
        );
    }
}