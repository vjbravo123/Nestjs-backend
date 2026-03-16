import { Injectable } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import logger from '../../common/utils/logger';

@Injectable()
export class TalkToExpertEventsListener {
    constructor(private readonly eventEmitter: EventEmitter2) { }

    @OnEvent('talktoexpert.created', { async: true })
    async handleTalkToExpert(payload: {
        requestId: string;
        name: string;
        phone: string;
        contactMethod: string;
        preferredTime: string;
        eventName?: string;
        createdAt?: string;
    }) {

        logger.info(
            `📞 [TalkToExpert] talktoexpert.created received | requestId=${payload.requestId}`,
        );

        logger.debug(
            `[TalkToExpert] Payload | ${JSON.stringify(payload)}`,
        );

        /**
         * Send alert
         */
        this.eventEmitter.emit('alert.send', {
            event: 'TALK_TO_EXPERT_REQUEST',
            channels: ['email'],
            data: payload,
        });

        logger.info(
            `✅ [TalkToExpert] Alert event emitted | requestId=${payload.requestId}`,
        );
    }
}