import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { PaymentConfigService } from './payment-config.service';
import { UpdatePaymentConfigDto } from './dto/update-payment-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';


// @UseGuards(JwtAuthGuard,RolesGuard)
@Controller('payment-config') 
export class PaymentConfigController {
  constructor(private readonly configService: PaymentConfigService) {}
  
  // @Roles('admin','user')
  @Get()
  getSettings() {
    return this.configService.getConfig();
  }
  
  // @Roles("admin")
  @Post()
  saveSettings(@Body() dto: UpdatePaymentConfigDto) {
    return this.configService.updateConfig(dto);
  }
} 