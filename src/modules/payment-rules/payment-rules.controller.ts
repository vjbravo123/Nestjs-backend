import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentRulesService } from './payment-rules.service';
import { CreatePaymentRuleDto, UpdatePaymentRuleDto } from './dto/payment-rules.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';


@Controller('milestone-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin') 
export class PaymentRulesController {
    constructor(private readonly rulesService: PaymentRulesService) {}

    @Post()
    create(@Body() dto: CreatePaymentRuleDto) {
        return this.rulesService.createRule(dto);
    }

    @Get()
    findAll() {
        return this.rulesService.findAll();
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdatePaymentRuleDto) {
        return this.rulesService.updateRule(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.rulesService.deleteRule(id);
    }
}