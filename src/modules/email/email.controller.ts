import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('emails')
export class EmailController {
  constructor(private readonly emailService: EmailService) { }

  @Post('test')
  async sendTestEmail(@Body() body: any) {
    await this.emailService.sendWelcomeEmail(body.email, {
      userName: body.name,
    });

    return { message: 'Email queued successfully' };
  }
}
