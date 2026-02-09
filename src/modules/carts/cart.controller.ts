import {
    Body,
    Controller,
    Post,
    Patch,
    Get,
    Param,
    NotFoundException,
    UseGuards,
    HttpCode,
    Req,
    Delete, Logger,
    Query,
    HttpStatus,
    BadRequestException,
    UseInterceptors,
    ClassSerializerInterceptor,
    ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Types } from 'mongoose'
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { AddDraftCartToCartDto } from './dto/add-draft-cart-to-cart.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { UpdateCartItemScheduleDto } from './dto/update-cart-item-schedule.dto'
import { UpdateAddonInCartDto } from './dto/update-addon-cart.dto'
import { GetCartByUserQueryDto } from './dto/get-cart-by-user.dto'
import { AddFromDraftParams } from './dto/add-from-draft.params';
import { DeleteCartItemDto } from './dto/delete-cart-item.dto';
import { MongoIdPipe } from '../../common/pipes/parse-objectid.pipe'
import logger from '../../common/utils/logger';
import { ValidatedParams } from '../../common/decorators/validated-params.decorator'
import { Type } from '@aws-sdk/client-s3';
import { add } from 'winston';
import { IsMongoId } from 'class-validator';
@ApiTags('Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
// @UseInterceptors(ClassSerializerInterceptor)
@Controller('cartItem')   // 🔥 UPDATED HERE
export class CartController {

    constructor(private readonly cartService: CartService) { }

    // ─────────── Add Event to Cart ───────────
    @Post('add')
    @Roles('user')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Add an event with selected tier to the user cart' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Event successfully added or updated in cart' })
    @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation or business rule error' })
    async addToCart(
        @CurrentUser() user: AuthUser,
        @Body() dto: AddToCartDto,
    ) {
        if (!user?.userId) {
            throw new ForbiddenException('Unauthorized: Missing user ID in token.');
        }

        const result = await this.cartService.addToCart(user.userId, dto);

        return {
            message: 'Event successfully added to cart.',
            data: result,
        };
    }


    // GET /cart
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get()
    @Roles('user')
    async getCart(
        @Req() req: any,
        @CurrentUser() user: AuthUser,) {

        if (!user?.userId) {
            throw new ForbiddenException('User ID missing in token.');
        }
        return this.cartService.getFullCartByUser(user.userId);
    }



    @Patch('schedule')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('user')
    async updateEventSchedule(
        @Param('cartItemId') cartItemId: string,
        @Body() dto: UpdateCartItemScheduleDto,
        @CurrentUser() user: AuthUser,
    ) {

        // ⛔ Check user authentication
        if (!user?.userId) {
            throw new ForbiddenException('User ID missing in token.');
        }

        // ⭐ Call service
        const updated = await this.cartService.updateEventSchedule(
            user.userId,
            dto,
        );

        return {
            message: 'Cart item schedule updated successfully.',
            data: updated,
        };
    }

    @Patch('update-addon')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('user')   // only normal users allowed
    async updateAddonInCart(@Req() req, @Body() dto: UpdateAddonInCartDto) {
        const userId = req.user.userId;
        return await this.cartService.updateAddonInCartByUser(userId, dto);
    }

    @Get(':itemId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('user')
    async getItemById(
        @Param('itemId') itemId: string,
        @CurrentUser() user: AuthUser,
    ) {
        // ⛔ Auth validation
        if (!user?.userId) throw new ForbiddenException('Unauthorized: missing userId');

        const item = await this.cartService.getCartItemById(
            itemId,
            user.userId, // pass userId for ownership check
        );

        if (!item) throw new NotFoundException('Cart item not found');

        return {
            message: 'Cart item fetched successfully.',
            data: item,
        };
    }


    // GET /admin/carts/user/:userId?limit=10&page=1&include=full
    @Get('user/:userId')
    @Roles('admin')
    @HttpCode(HttpStatus.OK)
    async getCartByUser(
        @Param('userId', MongoIdPipe) userId: Types.ObjectId,
        @Query() query: GetCartByUserQueryDto,
    ) {
        logger.debug(`Admin requested cart for user ${userId} – query=${JSON.stringify(query)}`);

        // parse query pagination
        const page = query.page ? Math.max(parseInt(query.page, 10), 1) : 1;
        const limit = query.limit ? Math.min(parseInt(query.limit, 10), 100) : 50;
        const include = query.include ?? 'summary';

        const result = await this.cartService.getCartByUserForAdmin(new Types.ObjectId(userId), {
            page,
            limit,
            include,
        });

        return {
            success: true,
            message: 'Cart fetched successfully',
            data: result,
        };
    }



    @Post('add-from-draft/:draftId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('user')
    async addFromDraft(
        @ValidatedParams(AddFromDraftParams) { draftId }: AddFromDraftParams,
        @CurrentUser() { userId }: AuthUser,
        @Body() addToCartDto: AddDraftCartToCartDto,

    ) {
        if (!userId) throw new ForbiddenException('Unauthorized: missing userId');

        const item = await this.cartService.addFromDraftCart(
            draftId,
            userId, addToCartDto.forceUpdate
        );

        return {
            message: 'Item successfully added to cart',
            item,
        };
    }



    @Patch('item/check-in-out/:cartItemId')
    @Roles('user')
    @HttpCode(HttpStatus.OK)
    async itemCheckOut(
        @CurrentUser() user: AuthUser,
        @Param('cartItemId', MongoIdPipe) cartItemId: Types.ObjectId,
    ) {
        if (!user?.userId) throw new ForbiddenException('Unauthorized: missing userId');

        logger.debug(`User ${user.userId} requested delete cart item ${String(cartItemId)}`);

        const result = await this.cartService.toggleCartItemCheckout(user.userId, cartItemId);

        return {
            message: 'Cart item checkIn or check out   successFully.',

        };
    }
    @Delete('item/:cartItemId')
    @Roles('user')
    @HttpCode(HttpStatus.OK)
    async deleteCartItem(
        @CurrentUser() user: AuthUser,
        @Param('cartItemId', MongoIdPipe) cartItemId: Types.ObjectId,
    ) {
        if (!user?.userId) throw new ForbiddenException('Unauthorized: missing userId');

        logger.debug(`User ${user.userId} requested delete cart item ${String(cartItemId)}`);

        const result = await this.cartService.deleteCartItem(user.userId, cartItemId);

        return {
            message: 'Cart item removed successfully.',
            data: result, // return updated cart summary or minimal info for safety
        };
    }



    @Delete('item/:cartItemId/:addonId')
    @Roles('user')
    @HttpCode(HttpStatus.OK)
    async deleteAddonByCartItemId(
        @CurrentUser() user: AuthUser,
        @Param('cartItemId', MongoIdPipe) cartItemId: Types.ObjectId,
        @Param('addonId', MongoIdPipe) addonId: Types.ObjectId,
    ) {
        if (!user?.userId) throw new ForbiddenException('Unauthorized: missing userId');

        logger.debug(`User ${user.userId} requested delete cart item ${String(cartItemId)}`);

        const result = await this.cartService.deleteAddonByCartItemId(user.userId, cartItemId, addonId);

        return {
            message: 'Cart item removed successfully.',
            data: result, // return updated cart summary or minimal info for safety
        };
    }


    @Patch('restore-to-draft/:cartItemId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('user')
    async restoreItemToDraft(
        @CurrentUser() { userId }: AuthUser,
        @Param('cartItemId', MongoIdPipe) cartItemId: Types.ObjectId,
    ) {
        if (!userId) { throw new ForbiddenException('Unauthorized: missing userId') }
        return this.cartService.restoreItemToDraft(userId, cartItemId);
    }



}
