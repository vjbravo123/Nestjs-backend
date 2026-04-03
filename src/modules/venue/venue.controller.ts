import {
  Controller, Get, Post, Body, Patch, Param,
  Delete, UploadedFiles, UseInterceptors, UseGuards, Query,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

import { VenueService } from './venue.service';
import { CreateVenueDto } from './create-venue.dto';
import { VenueQueryDto } from './venue-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { MongoIdPipe } from 'src/common/pipes/parse-objectid.pipe';

@Controller('venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(AnyFilesInterceptor())
  create(
    @Body() createVenueDto: CreateVenueDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.venueService.create(createVenueDto, files);
  }

  // ─── Admin GETs (all fields) ──────────

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAllAdmin(@Query() query: VenueQueryDto) {
    return this.venueService.findAll(query, true);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findOneAdmin(@Param('id', MongoIdPipe) id: Types.ObjectId) {
    return this.venueService.findOne(id, true);
  }

  // ─── Public GETs (limited fields) ─────────────────────────────────────────

  @Get()
  findAll(@Query() query: VenueQueryDto) {
    return this.venueService.findAll(query, false);
  }

  @Get(':id')
  findOne(@Param('id', MongoIdPipe) id: Types.ObjectId) {
    return this.venueService.findOne(id, false);
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(AnyFilesInterceptor())
  update(
    @Param('id', MongoIdPipe) id: Types.ObjectId,
    @Body() updateVenueDto: any,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.venueService.update(id, updateVenueDto, files);
  }

  @Patch(':id/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'vendor')
  toggleActive(@Param('id', MongoIdPipe) id: Types.ObjectId) {
    return this.venueService.toggleActive(id);
  }

  // ─── Soft Delete ───────────────────────────────────────────────────────────

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id', MongoIdPipe) id: Types.ObjectId) {
    return this.venueService.remove(id);
  }
}