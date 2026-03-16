import { Injectable } from '@nestjs/common';
import { EmailPayload } from '../interfaces/email-payload.interface';
import { renderTemplate } from '../utils/template-renderer';

@Injectable()
export class EmailAdapter {
  toProviderPayload(template: string, to: string, data: Record<string, any>): EmailPayload {
    const html = renderTemplate(template, data);
    const subject = require(`../templates/${template}/${template}.subject`).default;
    return { to, html, subject, fromName: 'YourApp', from: 'no-reply@yourapp.com' };
  }
}
