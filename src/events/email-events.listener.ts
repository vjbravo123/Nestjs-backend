// import { Injectable } from '@nestjs/common';
// import { OnEvent } from '@nestjs/event-emitter';
// import { EmailService } from '../modules/email/email.service';
// import { NotificationFacade } from '../modules/notification/application/notification.facade';
// import logger from '../common/utils/logger'
// @Injectable()
// export class EmailEventsListener {
//   constructor(
//     private readonly emailService: EmailService,
//     private readonly notificationFacade: NotificationFacade,
//   ) { }

//   // @OnEvent('user.registered')
//   // async handleUserRegisteredEvent(payload: { email: string; name: string }) {
//   //   await this.emailService.sendWelcomeEmail(payload.email, { name: payload.name });
//   // }
//   @OnEvent('order.completed')
//   async handleOrderCompletedEvent(payload: { email: string; orderId: string; amount: number }) {
//     await this.emailService.sendOrderSuccessEmail(payload.email, {
//       orderId: payload.orderId,
//       amount: payload.amount,
//     });
//   }


//   @OnEvent('user.logged_in')
//   async handleUserLoggedIn(payload: {
//     userId: string;
//     email: string;
//     name: string;
//     role?: 'user' | 'vendor';
//     mobile?: number;
//   }) {
//     logger.info(`📩 user.logged_in event received`);
//     logger.info(JSON.stringify(payload));

//     // Send email (optional - can be async)
//     this.emailService.sendWelcomeEmail(payload.email, {
//       name: payload.name,
//     }).catch(err => logger.error('Failed to send welcome email', err));

//     // Send push notification via queue
//     if (payload.userId) {
//       try {
//         await this.notificationFacade.sendPush(
//           payload.userId,
//           'Welcome back! 👋',
//           `Hi ${payload.name}, you have successfully logged in.`,
//           {
//             type: 'login',
//             role: payload.role || 'user',
//             timestamp: new Date().toISOString(),
//           }
//         );
//         logger.info(`✅ Login notification queued for user: ${payload.userId}`);
//       } catch (error) {
//         logger.error(`❌ Failed to queue login notification for user ${payload.userId}:`, error);
//       }
//     }
//   }

//   @OnEvent('order.created')
//   async handleOrderCreatedEvent(payload: {
//     email: string;
//     name: string;
//     orderId: string;
//     amount: number;
//   }) {
//     await this.emailService.sendOrderSuccessEmail(payload.email, {
//       name: payload.name,
//       orderId: payload.orderId,
//       amount: payload.amount,
//     });
//   }

//   @OnEvent('user.registered')
//   async handleUserRegisteredEvent(payload: {
//     email: string;
//     name: string;
//     role: 'user' | 'vendor';
//   }) {
//     await this.emailService.sendWelcomeEmail(payload.email, {
//       name: payload.name,
//       role: payload.role,
//     });
//   }

//   @OnEvent('payment.refund')
//   async handleRefundEvent(payload: { email: string; refundId: string; amount: number }) {
//     await this.emailService.sendRefundEmail(payload.email, { refundId: payload.refundId, amount: payload.amount });
//   }
// }
