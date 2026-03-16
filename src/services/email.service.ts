import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SendEmailService {
  private readonly logger = new Logger(SendEmailService.name);

  private readonly MSG91_URL = 'https://control.msg91.com/api/v5/email/send';
  private readonly AUTHKEY = process.env.MSG91_AUTHKEY;
  private readonly DOMAIN = process.env.MSG91_EMAIL_DOMAIN;
  private readonly FROM_EMAIL = process.env.MSG91_FROM_EMAIL;

  /**
   * Sends OTP Email using MSG91 Email API
   */
  async sendOtpEmail(toEmail: string, toName: string, otp: string) {
    const body = {
      recipients: [
        {
          to: [
            {
              email: toEmail,
              name: toName
            }
          ],
          variables: {
            company_name: "zappy",
            otp: otp
          }
        }
      ],
      from: {
        email: this.FROM_EMAIL
      },
      domain: this.DOMAIN,
      template_id: "global_otp"
    };

    try {
      const response = await axios.post(this.MSG91_URL, body, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          authkey: this.AUTHKEY,
        },
      });

      this.logger.log(`Email sent successfully → ${JSON.stringify(response.data)}`);
      return response.data;

    } catch (error: any) {
      this.logger.error(
        `Email sending failed → ${error.response?.data?.message || error.message}`
      );
      throw error;
    }
  }
}
