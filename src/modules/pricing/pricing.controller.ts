import { Body, Controller, Get, Patch, Post, Param, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { CreateAddOnDto } from './dto/create-addon.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) { }

  @Get()
  async getPricing() {
    return this.pricingService.getPricing();
  }

  @Patch('config')
  async updateConfig(@Body() updatePricingDto: UpdatePricingDto) {
    return this.pricingService.updateConfig(updatePricingDto);
  }

  @Post('addons')
  async addAddOn(@Body() createAddOnDto: CreateAddOnDto) {
    return this.pricingService.addAddOn(createAddOnDto);
  }

  @Patch('addons/:id/toggle')
  async toggleAddOn(@Param('id') id: string) {
    return this.pricingService.toggleAddOn(id);
  }
}