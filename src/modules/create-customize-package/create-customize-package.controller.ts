
import { CustomizePackageService } from './create-customize-package.service';
import { CreateCustomizePackageDto } from './dto/create-customize-package.dto';
import {
  Controller, Post, Body, UseGuards, Req, Delete, UploadedFiles, UseInterceptors, BadRequestException, Get, Query,
  Patch, NotFoundException, ForbiddenException,
  Param,
} from '@nestjs/common';
import { AdminQueryCustomizePackageDto } from './dto/admin-query-customize-package.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { Roles } from '../../common/decorators/roles.decorator';


import { AuthUser } from 'src/modules/auth/types/auth-user.type';



@Controller('customize-package')
export class CustomizePackageController {
  constructor(
    private readonly customizePackageService: CustomizePackageService,
  ) { }

  // ----------------------------
  // 📩 CREATE CUSTOM PACKAGE
  // ----------------------------
  @Post()
  async create(
    @Body() dto: CreateCustomizePackageDto,
  ) {
    return this.customizePackageService.create(dto);
  }

  // ----------------------------
  // 📋 GET ALL (ADMIN)
  // ----------------------------
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getCustomizePackagesForAdmin(

    @Query() query: AdminQueryCustomizePackageDto,
  ) {


    const data =
      await this.customizePackageService.getForAdmin(query);

    return {
      message: 'Customize package requests fetched successfully.',
      count: data.results.length,
      data,
    };
  }
}
