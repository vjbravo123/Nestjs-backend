import { Injectable } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import logger from '../../common/utils/logger';

@Injectable()
export class AuthEventsListener {
    constructor(
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * USER LOGIN EVENT
     */
    @OnEvent('user.logged_in', { async: true })
    async handleUserLoggedIn(payload: {
        userId: string;
        email: string;
        name: string;
        role: 'user' | 'vendor';
        mobile?: number;
    }) {
        logger.info('📩 [Auth] user.logged_in event received');
        logger.debug(JSON.stringify(payload));

        if (!payload.userId) return;

        // 🔥 Emit alert event
        this.eventEmitter.emit('alert.send', {
            event: 'USER_LOGGED_IN',
            userId: payload.userId,
            channels: ['email', 'push'],
            data: payload,
        });

        logger.info(
            `✅ [Auth] Alert event emitted for login user ${payload.userId}`,
        );
    }

    /**
     * USER REGISTERED EVENT
     */
    @OnEvent('user.registered', { async: true })
    async handleUserRegistered(payload: {
        userId: string;
        email: string;
        name: string;
        role: 'user';
        mobile?: number;
    }) {
        logger.info('📩 [Auth] user.registered event received');
        console.log("payload in auth event listener", payload)
        // 🔥 Emit alert event
        this.eventEmitter.emit('alert.send', {
            event: 'USER_REGISTERED',

            channels: ['email', 'whatsapp'],
            data: payload,
        });

        logger.info(
            `✅ [Auth] Alert event emitted for registered user ${payload}`,
        );
    }


    @OnEvent('vendor.registered', { async: true })
    async handleVendorRegistered(payload: {
        partnerId: string;
        partnerName: string;
        partnerEmail: string;
        partnerPhone?: number;
        registerDate: Date;
    }) {
        logger.info('📩 [Vendor] vendor.registered event received');
        console.log(
            'payload in vendor event listener',
            payload,
        );

        // 🔥 Emit alert event
        this.eventEmitter.emit('alert.send', {
            event: 'VENDOR_REGISTERED',
            channels: ['email', 'whatsapp'],
            data: payload,
        });

        logger.info(
            `✅ [Vendor] Alert event emitted for vendor ${payload.partnerEmail}`,
        );
    }
}
