import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, QUEUE_JOBS } from '../../../providers/queue/queue.constants';
import { SendPushJob } from '../../../providers/queue/queue.types';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationJobs {
    constructor(
        @InjectQueue(QUEUE_NAMES.NOTIFICATION)
        private readonly notificationQueue: Queue<SendPushJob>,
    ) { }

    async sendPush(payload: SendPushJob) {
        await this.notificationQueue.add(
            QUEUE_JOBS.SEND_PUSH,
            payload,
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
    }
}
