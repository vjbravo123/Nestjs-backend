import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../../auth/types/auth-user.type';
import { NotificationFacade } from '../application/notification.facade';
import { RegisterTokenDto } from '../application/dto/register-token.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

interface AuthRequest extends Request {
  user: AuthUser & {
    id: string;
  };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationFacade: NotificationFacade) {}

  /**
   * Register / refresh FCM token for logged-in user
   */
  @Post('register-token')
  async registerToken(
    @Req() req: AuthRequest,
    @Body() dto: RegisterTokenDto,
    @CurrentUser() { userId }: AuthUser,
  ) {
    if (!userId) throw new Error('Unauthorized');
    await this.notificationFacade.registerToken(
      userId,
      dto.token,
      dto.platform,
    );

    return {
      success: true,
      message: 'Notification token registered',
    };
  }
}
