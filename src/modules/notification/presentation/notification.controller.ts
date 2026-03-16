import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../../auth/types/auth-user.type';
import { NotificationFacade } from '../application/notification.facade';
import { RegisterTokenDto } from '../application/dto/register-token.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { OwnershipGuard } from '../../../common/guards/ownership.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequireOwnership } from '../../../common/decorators/ownership.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationFacade: NotificationFacade) {}

  /**
   * Register / refresh FCM token for logged-in user
   */
  @Post('register-token')
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles(UserRole.USER)
  @RequireOwnership('userId')
  async registerToken(
    @Body() dto: RegisterTokenDto,
    @CurrentUser() { userId }: AuthUser,
  ) {
    await this.notificationFacade.registerToken(
      userId!,
      dto.token,
      dto.platform,
    );

    return {
      success: true,
      message: 'Notification token registered',
    };
  }
}
