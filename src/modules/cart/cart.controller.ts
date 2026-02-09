import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('user')
export class CartController {
  constructor(private readonly cartService: CartService) { }

  // POST /cart/items
  @Post('items')
  async addItemToCart(@Body() dto: AddToCartDto, @Req() req) {
    console.log("req.user in cart", req.user);
    return this.cartService.addItemToCart(req.user.userId, dto);
  }
  // PATCH /cart/items/:id
  @Patch('items/:id')
  async updateCartItem(
    @Param('id') id: string,
    @Body() dto: UpdateCartDto,
    @Req() req,
  ) {
    return this.cartService.updateCartItem(id, req.user.userId, dto);
  }
  @Get('items/:id')
  async getCartItem(
    @Param('id') id: string,
    @Req() req,
  ) {
    return this.cartService.getCartIteById(id);
  }
  @Get('planner-price')
  async getPlannerPrice(
    @Req() req,
  ) {
    return this.cartService.getPlannerPrice(req.user.userId);
  }

  // GET /cart
  @Get()
  async getMyCart(@Query() query: any, @Req() req) {
    return this.cartService.getMyCart(req.user.userId);
  }

  // DELETE /cart/items/:id
  @Delete('items/:id')
  async removeCartItem(@Param('id') id: string, @Req() req) {
    return this.cartService.removeCartItem(id, req.user.userId);
  }


  @Post('preview-coupon')
  async previewCoupon(
    @Body() body: { cartId: string; couponId: string }
  ) {
    const { cartId, couponId } = body;
    return this.cartService.previewCoupon(cartId, { couponId: couponId });
  }

  // DELETE /cart
  @Delete()
  async clearCart(@Req() req) {
    return this.cartService.clearCart(req.user.userId);
  }
  @Get('upgrade-suggestions')
  async getUpgradeSuggestions(@Req() req) {
    return this.cartService.getUpgradeSuggestions(req.user.userId);
  }
}
