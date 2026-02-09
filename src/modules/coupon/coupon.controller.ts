import {
  Controller,
  Post,
  Query,
  Param,
  Patch,
  Body,
  Get,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CouponService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import pick from '../../common/utils/pick.util';

@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) { }

  // ✅ Admin: Create coupon
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCouponDto) {
    // const coupon =
    return await this.couponService.create(dto);
    // {
    //   statusCode: HttpStatus.CREATED,
    //   message: 'Coupon created successfully',
    //   data: coupon,
    // };
  }

  // ✅ Admin: Toggle coupon active/inactive
  @Patch(':couponId/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async toggleActiveStatus(@Param('couponId') couponId: string) {
    const updated = await this.couponService.toggleActive(couponId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Coupon status updated successfully',
      data: updated,
    };
  }

  // ✅ Admin: Get all coupons (with filters)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: any) {
    const filters = pick(query, [
      'code',
      'discountType',
      'isActive',
      'isExpire',
      'isGlobal',
      'birthdayEvent',
      'userLimit',
    ]);
    const options = pick(query, ['page', 'limit', 'sortBy', 'populate']);
    // const coupons =

    return await this.couponService.findAll({ ...filters, ...options });
  }

  // ✅ User: Get available coupons
  @Get('user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @HttpCode(HttpStatus.OK)
  async findCouponForUser(@Req() req, @Query() query: any) {
    const filters = pick(query, [
      'code',
      'discountType',
      'isActive',
      'isExpire',
      'isGlobal',
      'birthdayEvent',
      'userLimit',
    ]);
    const options = pick(query, ['page', 'limit', 'sortBy', 'populate']);
    const userId = req.user?._id || req.user?.userId; // handle both cases


    return await this.couponService.findCouponForUser({
      ...filters,
      ...options,
      userId,
    });
    // {
    //       statusCode: HttpStatus.OK,
    //       message: 'Available coupons fetched successfully',
    //       data: coupons,
    //     };
  }
}
