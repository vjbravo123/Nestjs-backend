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
  Delete,
  Logger,
  Query,
  HttpStatus,
  BadRequestException,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../common/casl/policies.guard';
import { CheckPolicies } from '../../common/casl/check-policies.decorator';
import { Action } from '../../common/casl/app-ability';
import { Types } from 'mongoose';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { AddDraftCartToCartDto } from './dto/add-draft-cart-to-cart.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { UpdateCartItemScheduleDto } from './dto/update-cart-item-schedule.dto';
import { UpdateAddonInCartDto } from './dto/update-addon-cart.dto';
import { GetCartByUserQueryDto } from './dto/get-cart-by-user.dto';
import { AddFromDraftParams } from './dto/add-from-draft.params';
import { DeleteCartItemDto } from './dto/delete-cart-item.dto';
import { MongoIdPipe } from '../../common/pipes/parse-objectid.pipe';
import logger from '../../common/utils/logger';
import { ValidatedParams } from '../../common/decorators/validated-params.decorator';
import { Type } from '@aws-sdk/client-s3';
import { add } from 'winston';
import { IsMongoId } from 'class-validator';
@ApiTags('Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
// @UseInterceptors(ClassSerializerInterceptor)
@Controller('cartItem')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // ─────────── Add Event to Cart ───────────
  @Post('add')
  @CheckPolicies((ability) => ability.can(Action.Create, 'Cart'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add an event with selected tier to the user cart' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Event successfully added or updated in cart',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation or business rule error',
  })
  async addToCart(@CurrentUser() user: AuthUser, @Body() dto: AddToCartDto) {
    const result = await this.cartService.addToCart(user.userId!, dto);

    return {
      message: 'Event successfully added to cart.',
      data: result,
    };
  }

  // GET /cart
  @Get()
  @CheckPolicies((ability) => ability.can(Action.Read, 'Cart'))
  async getCart(@Req() req: any, @CurrentUser() user: AuthUser) {
    return this.cartService.getFullCartByUser(user.userId!);
  }

  @Patch('schedule')
  @CheckPolicies((ability) => ability.can(Action.Update, 'Cart'))
  async updateEventSchedule(
    @Param('cartItemId') cartItemId: string,
    @Body() dto: UpdateCartItemScheduleDto,
    @CurrentUser() user: AuthUser,
  ) {
    const updated = await this.cartService.updateEventSchedule(
      user.userId!,
      dto,
    );

    return {
      message: 'Cart item schedule updated successfully.',
      data: updated,
    };
  }

  @Patch('update-addon')
  @CheckPolicies((ability) => ability.can(Action.Update, 'Cart'))
  async updateAddonInCart(
    @CurrentUser() { userId }: AuthUser,
    @Body() dto: UpdateAddonInCartDto,
  ) {
    return await this.cartService.updateAddonInCartByUser(userId!, dto);
  }

  @Get(':itemId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Cart'))
  async getItemById(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const item = await this.cartService.getCartItemById(
      itemId,
      user.userId!, // pass userId for ownership check
    );

    if (!item) throw new NotFoundException('Cart item not found');

    return {
      message: 'Cart item fetched successfully.',
      data: item,
    };
  }

  // GET /admin/carts/user/:userId?limit=10&page=1&include=full
  @Get('user/:userId')
  @CheckPolicies((ability) => ability.can(Action.Manage, 'Cart'))
  @HttpCode(HttpStatus.OK)
  async getCartByUser(
    @Param('userId', MongoIdPipe) userId: Types.ObjectId,
    @Query() query: GetCartByUserQueryDto,
  ) {
    logger.debug(
      `Admin requested cart for user ${userId} – query=${JSON.stringify(query)}`,
    );

    // parse query pagination
    const page = query.page ? Math.max(parseInt(query.page, 10), 1) : 1;
    const limit = query.limit ? Math.min(parseInt(query.limit, 10), 100) : 50;
    const include = query.include ?? 'summary';

    const result = await this.cartService.getCartByUserForAdmin(
      new Types.ObjectId(userId),
      {
        page,
        limit,
        include,
      },
    );

    return {
      success: true,
      message: 'Cart fetched successfully',
      data: result,
    };
  }

  @Post('add-from-draft/:draftId')
  @CheckPolicies((ability) => ability.can(Action.Update, 'Cart'))
  async addFromDraft(
    @ValidatedParams(AddFromDraftParams) { draftId }: AddFromDraftParams,
    @CurrentUser() { userId }: AuthUser,
    @Body() addToCartDto: AddDraftCartToCartDto,
  ) {
    const item = await this.cartService.addFromDraftCart(
      draftId,
      userId!,
      addToCartDto.forceUpdate,
    );

    return {
      message: 'Item successfully added to cart',
      item,
    };
  }

  @Patch('item/check-in-out/:cartItemId')
  @CheckPolicies((ability) => ability.can(Action.Update, 'Cart'))
  @HttpCode(HttpStatus.OK)
  async itemCheckOut(
    @CurrentUser() user: AuthUser,
    @Param('cartItemId', MongoIdPipe) cartItemId: Types.ObjectId,
  ) {
    logger.debug(
      `User ${user.userId} requested delete cart item ${String(cartItemId)}`,
    );

    const result = await this.cartService.toggleCartItemCheckout(
      user.userId!,
      cartItemId,
    );

    return {
      message: 'Cart item checkIn or check out   successFully.',
    };
  }
  @Delete('item/:cartItemId')
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Cart'))
  @HttpCode(HttpStatus.OK)
  async deleteCartItem(
    @CurrentUser() user: AuthUser,
    @Param('cartItemId', MongoIdPipe) cartItemId: Types.ObjectId,
  ) {
    logger.debug(
      `User ${user.userId} requested delete cart item ${String(cartItemId)}`,
    );

    const result = await this.cartService.deleteCartItem(
      user.userId!,
      cartItemId,
    );

    return {
      message: 'Cart item removed successfully.',
      data: result, // return updated cart summary or minimal info for safety
    };
  }

  @Delete('item/:cartItemId/:addonId')
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Cart'))
  @HttpCode(HttpStatus.OK)
  async deleteAddonByCartItemId(
    @CurrentUser() user: AuthUser,
    @Param('cartItemId', MongoIdPipe) cartItemId: Types.ObjectId,
    @Param('addonId', MongoIdPipe) addonId: Types.ObjectId,
  ) {
    logger.debug(
      `User ${user.userId} requested delete cart item ${String(cartItemId)}`,
    );

    const result = await this.cartService.deleteAddonByCartItemId(
      user.userId!,
      cartItemId,
      addonId,
    );

    return {
      message: 'Cart item removed successfully.',
      data: result, // return updated cart summary or minimal info for safety
    };
  }

  @Patch('restore-to-draft/:cartItemId')
  @CheckPolicies((ability) => ability.can(Action.Update, 'Cart'))
  async restoreItemToDraft(
    @CurrentUser() { userId }: AuthUser,
    @Param('cartItemId', MongoIdPipe) cartItemId: Types.ObjectId,
  ) {
    return this.cartService.restoreItemToDraft(userId!, cartItemId);
  }
}
