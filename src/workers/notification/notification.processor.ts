import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES, QUEUE_JOBS } from '../../providers/queue/queue.constants';
import { PushProvider } from './push.provider';
import logger from '../../common/utils/logger';

@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
    constructor(private readonly pushProvider: PushProvider) {
        super();
    }

    async process(job: Job) {
        logger.info(
            `⚙️ Processing notification | jobId=${job.id} | name=${job.name}`,
        );

        try {
            switch (job.name) {
                case QUEUE_JOBS.SEND_PUSH: {
                    const result = await this.pushProvider.send(job.data);

                    logger.info(
                        `📱 Push SENT | jobId=${job.id} | success=${result.successCount} | failed=${result.failureCount}`,
                    );

                    // ✅ THIS is delivery confirmation
                    return {
                        status: 'SENT',
                        successCount: result.successCount,
                        failureCount: result.failureCount,
                    };
                }

                default:
                    throw new Error(`Unknown job name: ${job.name}`);
            }
        } catch (error) {
            logger.error(
                `❌ Push FAILED | jobId=${job.id}`,
                error,
            );
            throw error; // retry
        }
    }
}
