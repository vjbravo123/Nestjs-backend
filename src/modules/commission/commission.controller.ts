import {Body, Controller, Get, Post, Patch ,Param, UseGuards, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CommissionService } from './commission.service';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { MongoIdPipe } from 'src/common/pipes/parse-objectid.pipe'; 
import { CreateCommissionDto } from './dto/create-commission.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('commission')
export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

  // Route matches: 
  // POST /commission/event/123 OR
  // POST /commission/service/456
  @Post(':type/:id')
  async createCommission(
    @Param('type') type: string,
    @Param('id', MongoIdPipe) id: Types.ObjectId, 
    @Body() createCommissionDto: CreateCommissionDto 
  ) {
    if (!['event', 'service'].includes(type)) {
      throw new BadRequestException('Type must be either "event" or "service"');
    }
    return this.commissionService.createCommission(type, id, createCommissionDto);
  }

   // Route matches:
   // GET /commission/event/123 or
   // GET /commission/service/456
  @Get(':type/:id')
  async getCommission(
    @Param('type') type: string,
    @Param('id', MongoIdPipe) id: Types.ObjectId
  ) {
    if (!['event', 'service'].includes(type)) {
      throw new BadRequestException('Type must be either "event" or "service"');
    }
    return this.commissionService.getCommission(type, id);
  }

  // Route matches:
  // PATCH /commission/event/123/config
  // PATCH /commission/service/123/config
  //finalprice function : 
  @Patch(':type/:id/config')
  async updateConfig(
    @Param('type') type: string,
    @Param('id', MongoIdPipe) id: Types.ObjectId, 
    @Body() updateCommissionDto: UpdateCommissionDto
  ) {
    if (!['event', 'service'].includes(type)) {
      throw new BadRequestException('Type must be either "event" or "service"');
    }

    if (!updateCommissionDto || Object.keys(updateCommissionDto).length === 0) {
      throw new BadRequestException('Request body cannot be empty for updates.');
    }

    return this.commissionService.updateCommissionConfig(type, id, updateCommissionDto);
  }
}