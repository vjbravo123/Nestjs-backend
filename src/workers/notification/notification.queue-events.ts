import { Injectable } from '@nestjs/common';
import { OnQueueEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import logger from '../../common/utils/logger';

@Injectable()
export class NotificationQueueEvents {
  /**
   * Fired when a job completes successfully
   */
  @OnQueueEvent('completed')
  onCompleted(job: Job, result: any) {
    logger.info(
      `✅ [QueueEvent] Push COMPLETED | jobId=${job.id} | result=${JSON.stringify(result)}`,
    );
  }

  /**
   * Fired when a job fails
   */
  @OnQueueEvent('failed')
  onFailed(job: Job, error: Error) {
    logger.error(
      `❌ [QueueEvent] Push FAILED | jobId=${job.id}`,
      error.stack,
    );
  }
}
