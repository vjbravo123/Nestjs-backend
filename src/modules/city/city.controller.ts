import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    Delete,
    Patch,
    ForbiddenException,
    BadRequestException,
    Query,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { CityService } from './city.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { MongoIdPipe } from '../../common/pipes/parse-objectid.pipe';
import { Types } from 'mongoose';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';

import { PublicCityQueryDto } from './dto/public-city-query.dto';
@Controller('cities')
export class CityController {
    constructor(private readonly cityService: CityService) { }

    // ────────────────────────────────────────────────────────────────
    // 🧩 ADMIN: Create City
    // ────────────────────────────────────────────────────────────────
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async createCity(@Body() dto: CreateCityDto) {
        const city = await this.cityService.create(dto);

        return {
            message: 'City created successfully.',
            data: city,
        };
    }

    // ────────────────────────────────────────────────────────────────
    // 🌍 PUBLIC: Get All Cities
    // ────────────────────────────────────────────────────────────────
    @Get()
    async getPublicCities(@Query() query: PublicCityQueryDto) {
        const cities = await this.cityService.getPublicCities(query);

        return cities
    }

    // ────────────────────────────────────────────────────────────────
    // 🧩 ADMIN: Activate / Deactivate City
    // ────────────────────────────────────────────────────────────────
    @Patch(':cityId/active')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async setCityActiveStatus(
        @Param('cityId', MongoIdPipe) cityId: Types.ObjectId,
    ) {
        const updated = await this.cityService.update(cityId.toString());

        return {
            message: `City ${updated.active ? 'activated' : 'deactivated'} successfully.`,
            data: updated,
        };
    }


    @Patch(':cityId/delete')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async deleteCityByAdmin(
        @Param('cityId') cityId: string,
        @CurrentUser() user: AuthUser,
    ) {
        // ✅ Validate city ID
        if (!Types.ObjectId.isValid(cityId)) {
            throw new BadRequestException('Invalid City ID');
        }

        // ✅ Validate admin
        const adminId = user?.adminId;
        if (!adminId) {
            throw new ForbiddenException('Admin ID missing in token.');
        }

        const deletedCity = await this.cityService.deleteCityByAdmin(cityId,);

        return {
            message: 'City deleted successfully.',
            data: deletedCity,
        };
    }

}
