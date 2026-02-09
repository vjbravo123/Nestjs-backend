import { Body, Controller, Query, Get, Post, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateAddressDto } from './dto/create-address.dto';
import { UsersService } from './users.service';
import pick from '../../common/utils/pick.util';
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAdminResource(@Req() req, @Query() query) {
    const filters = pick(query, ['role', 'name', 'email', 'mobile', 'search', 'isEmailVerified', 'isPhoneVerified', 'isActive']);
    const options = pick(query, ['page', 'limit', 'sortBy', 'populate']);
    return this.usersService.findAll({ ...filters, ...options });
  }

  @Post('me/addresses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  async addMyAddress(@Body() dto: CreateAddressDto, @Req() req) {
    console.log("user address token", req.user)

    const added = await this.usersService.addAddress(req.user.userId, dto);
    return { address: added };
  }
  @Get('me/addresses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  async getMyAddresses(@Req() req, @Query('isDefault') isDefault?: string) {
    const addresses = await this.usersService.getAddresses(
      req.user.userId,
      isDefault,
    );
    return { addresses };
  }


  @Get('by-mobile/:mobile')
  async getUserByMobile(
    @Param('mobile') mobile: string,
    @Query('type') type: 'user' | 'vendor',
  ) {


    const mobileNumber = Number(mobile);
    const exists = await this.usersService.isMobileExist(mobileNumber);

    return exists;
  }



  @Patch('me/addresses/:addressId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  async updateMyAddress(
    @Param('addressId') addressId: string,
    @Body() dto: Partial<CreateAddressDto>,
    @Req() req
  ) {
    const updated = await this.usersService.updateAddress(req.user.userId, addressId, dto);
    return { address: updated };
  }


  @Delete('me/addresses/:addressId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  async deleteMyAddress(
    @Param('addressId') addressId: string,
    @Req() req
  ) {
    const result = await this.usersService.deleteAddress(req.user.userId, addressId);
    return { success: !!result };
  }



  @Patch(':userId/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateActiveStatus(
    @Param('userId') userId: string,
  ) {
    console.log("inside the update active status");
    return this.usersService.updateActive(userId);
  }
}
