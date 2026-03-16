import { Body, Controller, Post, Req } from '@nestjs/common';
import { NotificationFacade } from '../../application/notification.facade';
import { RegisterTokenDto } from '../../application/dto/register-token.dto';

@Controller('notifications')
export class NotificationController {
    constructor(
        private readonly notificationFacade: NotificationFacade,
    ) { }

    @Post('register-token')
    async register(@Req() req, @Body() dto: RegisterTokenDto) {
        await this.notificationFacade.registerToken(
            req.user.id,
            dto.token,
            dto.platform,
        );
        return { success: true };
    }
}
