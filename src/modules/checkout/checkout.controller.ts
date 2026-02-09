import {
    Body,
    Controller,
    Post,
    Get,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { CheckoutService } from './checkout.service';
import { CreateCartCheckoutIntentDto } from './dto/create-cart-checkout-intent.dto';
import { CreateDirectCheckoutIntentDto } from './dto/create-direct-checkout-intent.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { MongoIdPipe } from '../../common/pipes/parse-objectid.pipe';
import { Types } from 'mongoose'
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('checkout')
export class CheckoutController {
    constructor(
        private readonly checkoutService: CheckoutService,
    ) { }

    // ─────────────────────────────────────────────
    // 🛒 CART CHECKOUT (MULTI ITEM)
    // ─────────────────────────────────────────────
    @Post('cart')
    @Roles('user')
    @HttpCode(HttpStatus.OK)
    async createCartCheckoutIntent(
        @CurrentUser() user: AuthUser,
        @Body() dto: CreateCartCheckoutIntentDto,
    ): Promise<CheckoutResponseDto> {

        if (!user?.userId) {
            throw new ForbiddenException('Unauthorized: missing userId in token');
        }

        return this.checkoutService.createCartCheckoutIntent(
            user.userId,
            dto,
        );
    }

    // ─────────────────────────────────────────────
    // ⚡ DIRECT CHECKOUT (SINGLE ITEM)
    // ─────────────────────────────────────────────
    @Post('direct')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('user')
    @HttpCode(HttpStatus.OK)
    async createDirectCheckoutIntent(
        @CurrentUser() { userId }: AuthUser,
        @Body() dto: CreateDirectCheckoutIntentDto,
    ): Promise<CheckoutResponseDto> {

        if (!userId) {
            throw new ForbiddenException('Unauthorized: missing userId');
        }

        return this.checkoutService.createDirectCheckoutIntent(
            userId,
            dto,
        );
    }


    // ─────────────────────────────────────────────
    // 🔍 GET CHECKOUT INTENT (OWNER ONLY)
    // ─────────────────────────────────────────────
    @Get(':intentId')
    @Roles('user')
    @HttpCode(HttpStatus.OK)
    async getCheckoutIntent(
        @CurrentUser() { userId }: AuthUser,
        @Param('intentId', MongoIdPipe) intentId: string,
    ) {

        if (!userId) {
            throw new ForbiddenException('Unauthorized: missing userId in token');
        }

        const intent = await this.checkoutService.getCheckoutIntent(
            new Types.ObjectId(intentId),
            userId,
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
    @Roles('user')
    @HttpCode(HttpStatus.OK)
    async getCheckoutIntentWithDetails(
        @CurrentUser() { userId }: AuthUser,
        @Param('intentId', MongoIdPipe) intentId: string,
    ) {

        if (!userId) {
            throw new ForbiddenException('Unauthorized: missing userId in token');
        }

        const intent = await this.checkoutService.getCheckoutIntentWithDetails(
            new Types.ObjectId(intentId),
            userId,
        );

        return {
            message: 'Checkout intent details fetched successfully',
            data: intent,
        };
    }
}
