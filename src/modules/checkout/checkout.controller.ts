import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../common/casl/policies.guard';
import { CheckPolicies } from '../../common/casl/check-policies.decorator';
import { Action } from '../../common/casl/app-ability';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { CheckoutService } from './checkout.service';
import { CreateCartCheckoutIntentDto } from './dto/create-cart-checkout-intent.dto';
import { CreateDirectCheckoutIntentDto } from './dto/create-direct-checkout-intent.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { MongoIdPipe } from '../../common/pipes/parse-objectid.pipe';
import { Types } from 'mongoose';
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  // ─────────────────────────────────────────────
  // 🛒 CART CHECKOUT (MULTI ITEM)
  // ─────────────────────────────────────────────
  @Post('cart')
  @CheckPolicies((ability) => ability.can(Action.Create, 'CheckoutIntent'))
  @HttpCode(HttpStatus.OK)
  async createCartCheckoutIntent(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCartCheckoutIntentDto,
  ): Promise<CheckoutResponseDto> {
    return this.checkoutService.createCartCheckoutIntent(user.userId!, dto);
  }

  // ─────────────────────────────────────────────
  // ⚡ DIRECT CHECKOUT (SINGLE ITEM)
  // ─────────────────────────────────────────────
  @Post('direct')
  @CheckPolicies((ability) => ability.can(Action.Create, 'CheckoutIntent'))
  @HttpCode(HttpStatus.OK)
  async createDirectCheckoutIntent(
    @CurrentUser() { userId }: AuthUser,
    @Body() dto: CreateDirectCheckoutIntentDto,
  ): Promise<CheckoutResponseDto> {
    return this.checkoutService.createDirectCheckoutIntent(userId!, dto);
  }

  // ─────────────────────────────────────────────
  // 🔍 GET CHECKOUT INTENT (OWNER ONLY)
  // ─────────────────────────────────────────────
  @Get(':intentId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'CheckoutIntent'))
  @HttpCode(HttpStatus.OK)
  async getCheckoutIntent(
    @CurrentUser() { userId }: AuthUser,
    @Param('intentId', MongoIdPipe) intentId: string,
  ) {
    const intent = await this.checkoutService.getCheckoutIntent(
      new Types.ObjectId(intentId),
      userId!,
    );

    if (!intent) {
      throw new NotFoundException('Checkout intent not found');
    }

    return {
      message: 'Checkout intent fetched successfully',
      data: intent,
    };
  }

 

  // ─────────────────────────────────────────────
  // 🔍 GET CHECKOUT INTENT WITH DETAILS (OWNER ONLY)
  // ─────────────────────────────────────────────
  @Get('details/:intentId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'CheckoutIntent'))
  @HttpCode(HttpStatus.OK)
  async getCheckoutIntentWithDetails(
    @CurrentUser() { userId }: AuthUser,
    @Param('intentId', MongoIdPipe) intentId: string,
  ) {
    const intent = await this.checkoutService.getCheckoutIntentWithDetails(
      new Types.ObjectId(intentId),
      userId!,
    );

    return {
      message: 'Checkout intent details fetched successfully',
      data: intent,
    };
  }
}

