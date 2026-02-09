import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationFacade } from '../../modules/notification/application/notification.facade';
import logger from '../../common/utils/logger';

type PushHandler = (data: any) => Promise<void>;

@Injectable()
export class NotificationPushEventsListener {
  private readonly handlers: Record<string, PushHandler>;

  constructor(
    private readonly notificationFacade: NotificationFacade,
  ) {
    this.handlers = {
      USER_LOGGED_IN: this.handleUserLoggedIn.bind(this),
      USER_REGISTERED: this.handleUserRegistered.bind(this),
      ORDER_CREATED: this.handleOrderCreated.bind(this),
    };
  }

  @OnEvent('alert.send', { async: true })
  async handlePushAlert(payload: {
    event: string;
    channels: string[];
    data: any;
  }) {
    if (!payload.channels.includes('push')) return;

    const handler = this.handlers[payload.event];

    if (!handler) {
      logger.warn(
        `⚠️ [Push] No handler found for event ${payload.event}`,
      );
      return;
    }

    logger.info(`📲 [Push] Processing event ${payload.event}`);
    await handler(payload.data);
  }

  // ======================
  // Event-specific handlers
  // ======================

  private async handleUserLoggedIn(data: any) {
    await this.notificationFacade.sendPush(
      data.userId,
      'Welcome back 👋',
      `Hi ${data.name}, you logged in successfully.`,
      {
        type: 'LOGIN_SUCCESS',
        role: data.role,
      },
    );
  }

  private async handleUserRegistered(data: any) {
    await this.notificationFacade.sendPush(
      data.userId,
      'Welcome to Zappy 🎉',
      `Hi ${data.name}, your account has been created.`,
      {
        type: 'ACCOUNT_CREATED',
        role: data.role,
      },
    );
  }

  private async handleOrderCreated(data: any) {
    await this.notificationFacade.sendPush(
      data.userId,
      'Order Placed ✅',
      `Your order ${data.orderId} was placed successfully.`,
      {
        type: 'ORDER_CREATED',
        orderId: data.orderId,
      },
    );
  }
}
