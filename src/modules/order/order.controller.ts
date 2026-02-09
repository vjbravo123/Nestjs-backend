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
    Req,
    Query,
    Param,
    HttpStatus,
    ForbiddenException,
    Patch,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from 'src/common/decorators/current-user.decorator';  // <-- your decorator
import { AuthUser } from '../auth/types/auth-user.type'
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { GetOrderParamDto } from './dto/get-order-param.dto';
import { Types } from 'mongoose';

import { MongoIdPipe } from 'src/common/pipes/parse-objectid.pipe';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { UserOrdersQueryDto } from './dto/user-orders-query.dto';
import { VendorOrdersQueryDto } from './dto/vendor-orders-query.dto';
@Controller('orders')
export class OrderController {
    constructor(private readonly orderService: OrderService) { }

    /**
     * Create an Order
     * Secure (JWT Auth)
     * Uses DTO + Validation Pipe
     * Auto-binds logged-in user
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('user')
    async createOrder(
        @Body() dto: CreateOrderDto,
        @CurrentUser() user: AuthUser,
    ) {

        if (!user.userId) throw new ForbiddenException('Forbidden')
        return this.orderService.createOrder(
            dto,
            user.userId

        );
    }



    /// get order list for user
    @Get()
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('user')
    async getMyOrders(@Query() q: UserOrdersQueryDto, @CurrentUser() { userId }: AuthUser, @Req() req) {
        if (!userId) throw new ForbiddenException("Forbidden ...")
        return this.orderService.getOrdersForUser(userId, q);
    }



    @Get('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async listOrders(@Query() q: AdminOrdersQueryDto, @CurrentUser() { adminId }: AuthUser, @Req() req) {
        return this.orderService.getOrdersForAdmin(q);
    }

    @Get('vendor')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async getOrdersForVendors(@Query() q: VendorOrdersQueryDto, @CurrentUser() { vendorId }: AuthUser, @Req() req) {
        if (!vendorId) throw new ForbiddenException("Forbidden ...")
        return this.orderService.getOrdersForVendor(vendorId, q);
    }



    @Get('vendor/next-upcoming')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async getNextUpcomingOrder(@CurrentUser() { vendorId }: AuthUser, @Req() req) {
        if (!vendorId) throw new ForbiddenException("Forbidden ...")
        return this.orderService.getNextUpcomingEventForVendor(vendorId);
    }










    @Get('vendor/events')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async listOrdersByVendor(@Query() q: VendorOrdersQueryDto, @CurrentUser() { vendorId }: AuthUser, @Req() req) {
        if (!vendorId) throw new ForbiddenException("Forbidden ...")
        return this.orderService.getOrdersEventForVendor(vendorId, q);
    }
    @Get('vendor/addons')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async listOrdersByVendorAddons(@Query() q: VendorOrdersQueryDto, @CurrentUser() { vendorId }: AuthUser, @Req() req) {
        if (!vendorId) throw new ForbiddenException("Forbidden ...")
        return this.orderService.getOrdersAddOnForVendor(vendorId, q);
    }


    @Get(':orderId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('user', 'vendor', 'admin')
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async getMyOrderById(
        @Param('orderId', MongoIdPipe) orderId: Types.ObjectId,
        @CurrentUser() user: AuthUser,
    ) {
        if (!user?.userId) {
            throw new ForbiddenException('Unauthorized access');
        }

        return this.orderService.getUserOrderById(orderId, user.userId);
    }
    @Get('vendor/:orderId/:bookingId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('user', 'vendor', 'admin')
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async getOrderByIdForVendor(
        @Param('orderId', MongoIdPipe) orderId: Types.ObjectId,
        @Param('bookingId', MongoIdPipe) bookingId: Types.ObjectId,
        @Query('type') type: "event" | "addon" | "AddOn",           // <-- corrected
        @CurrentUser() { vendorId }: AuthUser,
    ) {
        if (!vendorId) {
            throw new ForbiddenException('Unauthorized access');
        }

        if (!type || !["event", "addon", "AddOn"].includes(type)) {
            throw new BadRequestException('type must be "event" or "addon"');
        }

        return this.orderService.getOrderByIdForVendor(orderId, vendorId, bookingId, type);
    }


    @Get('admin/:orderId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async getOrderByIdForAdmin(
        @Param('orderId', MongoIdPipe) orderId: Types.ObjectId,

    ) {


        return this.orderService.getOrderByIdForAdmin(orderId);
    }






    @Get('batch/:batchId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('user')
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async getMyOrdersByBatchId(
        @Param('batchId', MongoIdPipe) batchId: Types.ObjectId,
        @CurrentUser() { userId }: AuthUser,
    ) {
        if (!userId) {
            throw new ForbiddenException('Unauthorized access');
        }

        return this.orderService.getUserOrdersByBatchId(batchId, userId);
    }


    @Get('/user/summary/count')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('user')
    async getUserOrderCount(@CurrentUser() { userId }: AuthUser) {
        if (!userId) {
            throw new ForbiddenException('Unauthorized access');
        }
        return this.orderService.getUserOrderCount(userId);
    }

    /**
     * Update order by admin
     * PATCH /orders/admin/:orderId
     * Only admin can access this endpoint
     */
    @Patch('admin/:orderId')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async updateOrderByAdmin(
        @Param('orderId', MongoIdPipe) orderId: Types.ObjectId,
        @Body() updateDto: UpdateOrderDto,
        @CurrentUser() { adminId }: AuthUser,
    ) {
        if (!adminId) {
            throw new ForbiddenException('Unauthorized access');
        }

        return this.orderService.updateOrderByAdmin(orderId, updateDto);
    }


}
