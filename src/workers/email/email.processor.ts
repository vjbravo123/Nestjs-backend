import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../providers/queue/queue.constants';
import { SendEmailJob } from '../../providers/queue/queue.types';
import { renderTemplate } from '../../modules/email/utils/template-renderer';
import { SmtpProvider } from '../../modules/email/providers/smtp.provider';
@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly smtpProvider: SmtpProvider) {
    super();
  }

  /**
   * BullMQ worker entry point
   */
  async process(job: Job<SendEmailJob>) {
    const { to, template, payload, subject } = job.data;

    try {
      this.logger.log(`⚙️ Processing email job | jobId=${job.id}`);

      // 1️⃣ Normalize recipients
      const normalizedTo = Array.isArray(to) ? to.join(',') : to;

      // 2️⃣ Render email HTML
      const html = renderTemplate(template, payload);

      // 3️⃣ Resolve subject safely
      const resolvedSubject = subject ?? this.resolveSubject(template);

      // 4️⃣ Update progress
      await job.updateProgress(50);

      // 5️⃣ Send email
      await this.smtpProvider.send({
        to: normalizedTo,
        subject: resolvedSubject,
        html,
      });

      // 6️⃣ Final progress
      await job.updateProgress(100);

      this.logger.log(
        `📧 Email sent successfully | jobId=${job.id} | to=${normalizedTo}`,
      );

      // ✅ Returning data = job COMPLETED with result
      return {
        status: 'sent',
        to: normalizedTo,
        template,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Email job failed | jobId=${job.id}`,
        error.stack,
      );
      throw error; // REQUIRED for retry
    }
  }

  /**
   * Safe subject resolver
   */
  private resolveSubject(template: string): string {
    try {
      console.log('template name in subject resolver:', template);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require(`../../modules/email/templates/${template}/${template}.subject`).default;
    } catch {
      this.logger.warn(
        `⚠️ Subject file missing for template: ${template}`,
      );
      return 'Notification from Zappy';
    }
  }
}
