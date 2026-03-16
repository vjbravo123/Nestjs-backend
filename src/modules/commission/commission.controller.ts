import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Query,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CommissionService } from './commission.service';
import { CreateCommissionDto } from './dto/create-commission.dto';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { GetTierQueryDto } from './dto/get-commission-with-query.dto';
import { CommissionType } from './enums/commission-type.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
@Controller('commission')
export class CommissionController {
  constructor(private readonly service: CommissionService) { }

  @Post(':type/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(
    @Param('type') type: CommissionType,
    @Param('id') id: string,
    @Body() dto: CreateCommissionDto,
  ) {
    return this.service.create(type, new Types.ObjectId(id), dto);
  }

  @Get(':type/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getCommissionWithQuery(
    @Param('type') type: CommissionType,
    @Param('id') id: string,
    @Query() query: GetTierQueryDto,
  ) {
    const data = await this.service.getCommissionWithQuery(
      type,
      new Types.ObjectId(id),
      query,
    );

    return {
      message: 'Commission fetched successfully.',
      data
    };
  }

  @Put(':type/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(
    @Param('type') type: CommissionType,
    @Param('id') id: string,
    @Body() dto: UpdateCommissionDto,
  ) {
    return this.service.update(type, new Types.ObjectId(id), dto);
  }
}