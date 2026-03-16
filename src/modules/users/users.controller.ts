import {
  Body,
  Controller,
  Query,
  Get,
  Post,
  Patch,
  Param,
  ForbiddenException,
  BadRequestException,
  UploadedFiles,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { RequireOwnership } from '../../common/decorators/ownership.decorator';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { Types } from 'mongoose';
import { uploadImageToS3 } from '../../common/utils/s3-upload.util';
import { UsersService } from './users.service';
import { MongoIdPipe } from '../../common/pipes/parse-objectid.pipe';
import pick from '../../common/utils/pick.util';
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAdminResource(@Req() req, @Query() query) {
    const filters = pick(query, [
      'role',
      'name',
      'email',
      'mobile',
      'search',
      'isEmailVerified',
      'isPhoneVerified',
      'isActive',
    ]);
    const options = pick(query, ['page', 'limit', 'sortBy', 'populate']);
    return this.usersService.findAll({ ...filters, ...options });
  }

  @Post('me/addresses')
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('user')
  @RequireOwnership('userId')
  async addMyAddress(@Body() dto: CreateAddressDto, @Req() req) {
    const added = await this.usersService.addAddress(req.user.userId, dto);
    return { address: added };
  }
  @Get('me/addresses')
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('user')
  @RequireOwnership('userId')
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
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('user')
  @RequireOwnership('userId')
  async updateMyAddress(
    @Param('addressId') addressId: string,
    @Body() dto: Partial<CreateAddressDto>,
    @Req() req,
  ) {
    const updated = await this.usersService.updateAddress(
      req.user.userId,
      addressId,
      dto,
    );
    return { address: updated };
  }

  @Delete('me/addresses/:addressId')
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('user')
  @RequireOwnership('userId')
  async deleteMyAddress(@Param('addressId') addressId: string, @Req() req) {
    const result = await this.usersService.deleteAddress(
      req.user.userId,
      addressId,
    );
    return { success: !!result };
  }

  // controller/users.controller.ts

  @Patch(':userIds')
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles('user')
  @RequireOwnership('userId')
  async updateUserById(
    @Param('userIds', MongoIdPipe) userIds: Types.ObjectId,
    @Body() dto: UpdateUserDto,
    @CurrentUser() { userId }: AuthUser,
    @UploadedFiles() files?: { image?: Express.Multer.File[] },
  ) {
    // if (files?.image?.length) {
    //   const imageUrl = await Promise.all(
    //     files.image.map(async (file, index) => {
    //       const s3Url = await uploadImageToS3({
    //         fileBuffer: file.buffer,
    //         key: `user/${userId}-${Date.now()}-${index}-${file.originalname}`,
    //         contentType: file.mimetype,
    //       });

    //       return s3Url;
    //     }),
    //   );

    //   UpdateUserDto.profileImage = imageUrl;
    // }

    if (!userId)
      throw new ForbiddenException(
        'You are not allowed to update this profile.',
      );

    // 🔐 Ownership enforcement
    if (userId.toString() !== userIds.toString()) {
      throw new ForbiddenException(
        'You are not allowed to update this profile.',
      );
    }

    const updatedUser = await this.usersService.updateUserById(userId, dto);

    return {
      message: 'Profile updated successfully.',
      data: updatedUser,
    };
  }

  @Patch(':userId/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateActiveStatus(@Param('userId') userId: string) {
    console.log('inside the update active status');
    return this.usersService.updateActive(userId);
  }
}
