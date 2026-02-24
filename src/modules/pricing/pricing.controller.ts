import { Body, Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('admin')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) { }

  @Get(':serviceId')
  async getPricing(@Param('serviceId') serviceId: string) {
    return this.pricingService.getPricing(serviceId);
  }

  @Patch(':serviceId/config')
  async updateConfig(
    @Param('serviceId') serviceId: string, 
    @Body() updatePricingDto: UpdatePricingDto
  ) {
    return this.pricingService.updateConfig(serviceId, updatePricingDto);
  }
}