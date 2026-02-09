import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

import { EmailProvider } from '../interfaces/email-provider.interface';
import { EmailPayload } from '../interfaces/email-payload.interface';

@Injectable()
export class SmtpProvider implements EmailProvider {
  private readonly transporter: Transporter | null;
  private readonly isConfigured: boolean;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('smtp.host');
    const port = this.config.get<number>('smtp.port');
    const user = this.config.get<string>('smtp.user');
    const pass = this.config.get<string>('smtp.pass');

    // SMTP is optional - only configure if all required fields are present
    this.isConfigured = !!(host && port && user && pass);

    if (this.isConfigured) {
      this.transporter = createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      console.log('✅ SMTP provider configured successfully');
    } else {
      this.transporter = null;
      console.warn(
        '⚠️ SMTP provider not configured (missing credentials). Email will use MSG91 only.',
      );
    }
  }

  async send(payload: EmailPayload): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      throw new Error(
        'SMTP provider is not configured. Please use MSG91 email provider instead.',
      );
    }

    const from = this.config.get<string>('smtp.from');

    await this.transporter.sendMail({
      from: `"${payload.fromName || 'Zappy'}" <${from}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
  }
}
