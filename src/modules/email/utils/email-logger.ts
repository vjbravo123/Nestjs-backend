import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailLogger {
  private readonly logger = new Logger('Email');

  log(to: string, template: string) {
    this.logger.log(`Email sent to ${to} using template ${template}`);
  }

  error(message: string, trace?: string) {
    this.logger.error(message, trace);
  }
}
