import {
  Body,
  Controller,
  Post,
  UseGuards,
  Get,
  UsePipes,
  ValidationPipe,
  HttpCode,
  BadRequestException,
  Query,
  Param,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderQueryService } from './services/order-query.service';
import { AdminOrderService } from './services/admin-order.service';
import { VendorOrderService } from './services/vendor-order.service';
import { OrderAvailabilityService } from './services/order-availability.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { GetUnavailableDatesDto } from './dto/get-unavailable-dates.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator'; 
import { AuthUser } from '../auth/types/auth-user.type';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { OwnershipGuard } from 'src/common/guards/ownership.guard';
import { RequireOwnership } from 'src/common/decorators/ownership.decorator';
import { GetOrderParamDto } from './dto/get-order-param.dto';
import { Types } from 'mongoose';
import { StreamableFile, Res, Header } from '@nestjs/common';


import { MongoIdPipe } from 'src/common/pipes/parse-objectid.pipe';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { UserOrdersQueryDto } from './dto/user-orders-query.dto';
import { VendorOrdersQueryDto } from './dto/vendor-orders-query.dto';
import { VendorBookingCountQueryDto } from './dto/vendor-booking-count-query.dto';
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderQueryService: OrderQueryService,
    private readonly adminOrderService: AdminOrderService,
    private readonly vendorOrderService: VendorOrderService,
    private readonly orderAvailabilityService: OrderAvailabilityService,
  ) { }

  /**
   * Create an Order
   * Secure (JWT Auth)
   * Uses DTO + Validation Pipe
   * Auto-binds logged-in user
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('user')
  @RequireOwnership('userId')
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orderService.createOrder(dto, user.userId!);
  }

  @Post('create-order')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('user')
  @RequireOwnership('userId')
  async createOrderBtIntentCart(
    @Body() body: { intentId: string; paymentId: string },
    @CurrentUser() user: AuthUser,
  ) {
    const intentObjectId = new Types.ObjectId(body.intentId);

    return this.orderService.createOrderFromCheckoutIntent(
      intentObjectId,
      body.paymentId,
    );
  }

  @Get('checkout/:checkoutId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @RequireOwnership('userId')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async getMyOrdersByCheckoutId(
    @Param('checkoutId', MongoIdPipe) checkoutId: Types.ObjectId,
    @CurrentUser() { userId }: AuthUser,
  ) {
    // console.log(userId)
    return this.orderQueryService.getUserOrdersByCheckoutId(checkoutId, userId!);
  }


  // endpoint to create the pdf of booking summary
  @Get(':orderId/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'vendor', 'admin')
  @Header('Content-Type', 'application/pdf')
  async downloadBookingPdf(
    @Param('orderId', MongoIdPipe) orderId: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: any,
  ) {
    console.log(orderId , user);
    
    const pdfBuffer = await this.orderService.generateBookingSummaryPdf(orderId, user.userId!);
    
    res.set({
      'Content-Disposition': `attachment; filename="booking-summary-${orderId}.pdf"`,
    });
    
    return new StreamableFile(pdfBuffer);
  }

  /// get order list for user
  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('user')
  @RequireOwnership('userId')
  async getMyOrders(
    @Query() q: UserOrdersQueryDto,
    @CurrentUser() { userId }: AuthUser,
  ) {
    return this.orderQueryService.getOrdersForUser(userId!, q);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('admin')
  @RequireOwnership('adminId')
  async listOrders(
    @Query() q: AdminOrdersQueryDto,
    @CurrentUser() { adminId }: AuthUser,
  ) {
    return this.adminOrderService.getOrdersForAdmin(q);
  }

  @Get('vendor')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('vendor')
  @RequireOwnership('vendorId')
  async getOrdersForVendors(
    @Query() q: VendorOrdersQueryDto,
    @CurrentUser() { vendorId }: AuthUser,
  ) {
    return this.vendorOrderService.getOrdersForVendor(vendorId!, q);
  }

  @Get('vendor/next-upcoming')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('vendor')
  @RequireOwnership('vendorId')
  async getNextUpcomingOrder(@CurrentUser() { vendorId }: AuthUser) {
    return this.vendorOrderService.getNextUpcomingEventForVendor(vendorId!);
  }

  @Get('vendor/booking-count')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('vendor')
  @RequireOwnership('vendorId')
  async getVendorBookingCountByDate(
    @Query() query: VendorBookingCountQueryDto,
    @CurrentUser() { vendorId }: AuthUser,
  ) {
    return this.vendorOrderService.getVendorBookingCountByDate(
      vendorId!,
      query,
    );
  }

  @Get('vendor/events')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('vendor')
  @RequireOwnership('vendorId')
  async listOrdersByVendor(
    @Query() q: VendorOrdersQueryDto,
    @CurrentUser() { vendorId }: AuthUser,
  ) {
    return this.vendorOrderService.getOrdersEventForVendor(vendorId!, q);
  }
  @Get('vendor/addons')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('vendor')
  @RequireOwnership('vendorId')
  async listOrdersByVendorAddons(
    @Query() q: VendorOrdersQueryDto,
    @CurrentUser() { vendorId }: AuthUser,
  ) {
    return this.vendorOrderService.getOrdersAddOnForVendor(vendorId!, q);
  }

  @Get('unavailable-dates')
  async getUnavailableDates(@Query() query: GetUnavailableDatesDto) {
    const { eventId, city, month, year, eventType } = query;

    const dates =
      await this.orderAvailabilityService.getUnavailableDatesForEvent({
        eventId,
        city,
        month,
        year,
        eventType,
      });

    return {
      success: true,
      data: dates,
    };
  }

  @Get(':orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'vendor', 'admin')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async getMyOrderById(
    @Param('orderId', MongoIdPipe) orderId: Types.ObjectId,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orderQueryService.getUserOrderById(orderId, user.userId!);
  }
  @Get('vendor/:orderId/:bookingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'vendor', 'admin')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async getOrderByIdForVendor(
    @Param('orderId', MongoIdPipe) orderId: Types.ObjectId,
    @Param('bookingId', MongoIdPipe) bookingId: Types.ObjectId,
    @Query('type') type: 'event' | 'addon' | 'AddOn', // <-- corrected
    @CurrentUser() { vendorId }: AuthUser,
  ) {
    if (!type || !['event', 'addon', 'AddOn'].includes(type)) {
      throw new BadRequestException('type must be "event" or "addon"');
    }

    return this.vendorOrderService.getOrderByIdForVendor(
      orderId,
      vendorId!,
      bookingId,
      type,
    );
  }

  @Get('admin/vendors/booking-count')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'user', 'vendor')
  async getOrderByQuery(@Query() query: VendorOrdersQueryDto) {
    return this.adminOrderService.getOrderByQuery(query);
  }

  @Get('admin/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('admin')
  @RequireOwnership('adminId')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async getOrderByIdForAdmin(
    @Param('orderId', MongoIdPipe) orderId: Types.ObjectId,
  ) {
    return this.adminOrderService.getOrderByIdForAdmin(orderId);
  }

  @Get('batch/:batchId')
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('user')
  @RequireOwnership('userId')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async getMyOrdersByBatchId(
    @Param('batchId', MongoIdPipe) batchId: Types.ObjectId,
    @CurrentUser() { userId }: AuthUser,
  ) {
    return this.orderQueryService.getUserOrdersByBatchId(batchId, userId!);
  }

  @Get('/user/summary/count')
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('user')
  @RequireOwnership('userId')
  async getUserOrderCount(@CurrentUser() { userId }: AuthUser) {
    return this.orderQueryService.getUserOrderCount(userId!);
  }

  /**
   * Update order by admin
   * PATCH /orders/admin/:orderId
   * Only admin can access this endpoint
   */
  @Patch('admin/:orderId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('admin')
  @RequireOwnership('adminId')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateOrderByAdmin(
    @Param('orderId', MongoIdPipe) orderId: Types.ObjectId,
    @Body() updateDto: UpdateOrderDto,
    @CurrentUser() { adminId }: AuthUser,
  ) {
    return this.adminOrderService.updateOrderByAdmin(orderId, updateDto);
  }
}
