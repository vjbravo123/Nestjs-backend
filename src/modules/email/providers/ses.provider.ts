// import { Injectable } from '@nestjs/common';
// import { SES } from 'aws-sdk';
// import { EmailProvider } from '../interfaces/email-provider.interface';
// import { EmailPayload } from '../interfaces/email-payload.interface';
// import { ConfigService } from '@nestjs/config';

// @Injectable()
// export class SesProvider implements EmailProvider {
//   private ses: SES;

//   constructor(private readonly config: ConfigService) {
//     this.ses = new SES({
//       region: config.get('AWS_REGION'),
//       accessKeyId: config.get('AWS_ACCESS_KEY_ID'),
//       secretAccessKey: config.get('AWS_SECRET_ACCESS_KEY'),
//     });
//   }

//   async send(payload: EmailPayload): Promise<void> {
//     await this.ses
//       .sendEmail({
//         Source: payload.from || 'no-reply@example.com',
//         Destination: { ToAddresses: [payload.to] },
//         Message: {
//           Subject: { Data: payload.subject },
//           Body: { Html: { Data: payload.html } },
//         },
//       })
//       .promise();
//   }
// }
