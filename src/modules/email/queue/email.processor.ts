import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { QUEUE_NAMES } from '../../../providers/queue/queue.constants';
import { SendEmailJob } from '../../../providers/queue/queue.types';
import { renderTemplate } from '../utils/template-renderer';
import { SmtpProvider } from '../providers/smtp.provider';

@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor extends WorkerHost {
  constructor(private readonly smtpProvider: SmtpProvider) {
    super();
  }

  /**
   * BullMQ entry point
   */
  async process(job: Job<SendEmailJob>): Promise<void> {
    try {
      const { to, template, payload, subject } = job.data;

      // ✅ Normalize "to"
      const normalizedTo = Array.isArray(to) ? to.join(',') : to;

      // ✅ Render HTML
      const html = renderTemplate(template, payload);

      // ✅ Resolve subject safely
      const resolvedSubject =
        subject ??
        require(`../templates/${template}/${template}.subject`).default;

      await this.smtpProvider.send({
        to: normalizedTo,
        subject: resolvedSubject,
        html,
      });
    } catch (error) {
      console.error(`❌ Email job failed [${job.id}]`, error);
      throw error; // important for BullMQ retry
    }
  }
}
