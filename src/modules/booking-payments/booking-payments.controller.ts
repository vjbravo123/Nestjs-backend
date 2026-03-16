import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { PaymentConfigService } from './payment-config.service';
import { UpdatePaymentConfigDto } from './dto/update-payment-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';

@Controller('payment-config')
export class PaymentConfigController {
  constructor(
    private readonly configService: PaymentConfigService,
  ) { }

  /* ------------------------------------------------
     GET PAYMENT CONFIG
  ------------------------------------------------ */
  @Get()
  async getSettings() {
    try {
      console.log('✅ GET /payment-config called');

      const config = await this.configService.getConfig();

      console.log('✅ Config fetched successfully');

      return {
        message: 'Payment configuration fetched successfully.',
        data: config,
      };
    } catch (error) {
      console.error('❌ Error inside getSettings():', error);
      throw error;
    }
  }

  /* ------------------------------------------------
     UPDATE PAYMENT CONFIG (ADMIN ONLY)
  ------------------------------------------------ */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async saveSettings(
    @Body() dto: UpdatePaymentConfigDto,
    @CurrentUser() { adminId }: AuthUser,
  ) {
    if (!adminId) {
      throw new ForbiddenException('Admin ID missing in token.');
    }

    const updatedConfig = await this.configService.updateConfig(dto);

    return {
      message: 'Payment configuration updated successfully.',
      data: updatedConfig,
    };
  }
}
