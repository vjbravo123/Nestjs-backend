import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QUEUE_NAMES, QUEUE_JOBS } from '../../../providers/queue/queue.constants';
import { SendEmailJob } from '../../../providers/queue/queue.types';

@Injectable()
export class EmailQueue {
  private readonly logger = new Logger(EmailQueue.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL)
    private readonly queue: Queue<SendEmailJob>,
  ) { }

  /**
   * Add email job to queue
   * @returns jobId - used for tracking success/failure
   */
  async sendEmail(job: SendEmailJob): Promise<string> {
    const queueJob = await this.queue.add(
      QUEUE_JOBS.SEND_EMAIL,
      job,
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false, // keep failed jobs (DLQ)
      },
    );

    this.logger.log(
      `📥 Email job queued | jobId=${queueJob.id} | to=${job.to}`,
    );

    return queueJob.id as string;
  }
}
