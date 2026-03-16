import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  BadRequestException,
  ForbiddenException,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { StateService } from './state.service';
import { CreateStateDto } from './dto/create-state.dto';
import { PublicStateQueryDto } from './dto/public-state-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { MongoIdPipe } from '../../common/pipes/parse-objectid.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';

@Controller('states')
export class StateController {
  constructor(private readonly stateService: StateService) {}

  // ────────────────────────────────────────────────────────────────
  // 🧩 ADMIN: Create State
  // ────────────────────────────────────────────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createState(@Body() dto: CreateStateDto) {
    const state = await this.stateService.create(dto);
    return {
      message: 'State created successfully.',
      data: state,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // 🌍 PUBLIC: Get All States (with filters & pagination)
  // ────────────────────────────────────────────────────────────────
  @Get()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async getPublicStates(@Query() query: PublicStateQueryDto) {
    return this.stateService.getPublicStates(query);
  }

  // ────────────────────────────────────────────────────────────────
  // 🌍 PUBLIC: Get Single State by ID
  // ────────────────────────────────────────────────────────────────
  @Get(':stateId')
  async getStateById(@Param('stateId', MongoIdPipe) stateId: Types.ObjectId) {
    const state = await this.stateService.findOne(stateId.toString());
    return {
      message: 'State fetched successfully.',
      data: state,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // 🧩 ADMIN: Activate / Deactivate State
  // ────────────────────────────────────────────────────────────────
  @Patch(':stateId/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async toggleActiveStatus(
    @Param('stateId', MongoIdPipe) stateId: Types.ObjectId,
  ) {
    const updated = await this.stateService.toggleActive(stateId.toString());
    return {
      message: `State ${updated.active ? 'activated' : 'deactivated'} successfully.`,
      data: updated,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // 🧩 ADMIN: Soft Delete State
  // ────────────────────────────────────────────────────────────────
  @Patch(':stateId/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deleteStateByAdmin(
    @Param('stateId') stateId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (!Types.ObjectId.isValid(stateId)) {
      throw new BadRequestException('Invalid State ID');
    }

    const adminId = user?.adminId;
    if (!adminId) {
      throw new ForbiddenException('Admin ID missing in token.');
    }

    const deleted = await this.stateService.deleteStateByAdmin(stateId);
    return {
      message: 'State deleted successfully.',
      data: deleted,
    };
  }
}
