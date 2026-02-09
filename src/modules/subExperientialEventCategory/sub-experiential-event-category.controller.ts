import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    Patch,
    Delete,
    Query,
    UseGuards,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { SubExperientialEventCategoryService } from './sub-experiential-event-category.service';
import { CreateSubExperientialEventCategoryDto } from './dto/create-sub-experiential-event-category.dto';
import { UpdateSubExperientialEventCategoryDto } from './dto/update-sub-experiential-event-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';

@Controller('sub-experiential-event-categories')
export class SubExperientialEventCategoryController {
    constructor(
        private readonly service: SubExperientialEventCategoryService,
    ) { }

    @Post()
    async create(@Body() dto: CreateSubExperientialEventCategoryDto) {
        return this.service.create(dto);
    }

    @Get()
    async findAll(@Query() query: any) {
        return this.service.findAll(query);
    }

    @Get(':id')
    async findById(@Param('id') id: string) {
        return this.service.findById(id);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async update(
        @Param('id') id: string,
        @CurrentUser() user: AuthUser,
        @Body() dto: UpdateSubExperientialEventCategoryDto,
    ) {
        return this.service.update(id, dto);
    }

    // ✅ ADMIN SOFT DELETE
    @Patch(':id/delete')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async deleteByAdmin(
        @Param('id') id: string,
        @CurrentUser() user: AuthUser,
    ) {
        // ✅ Validate ID
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid SubExperientialEventCategory ID');
        }

        // ✅ Validate admin
        const adminId = user?.adminId;
        if (!adminId) {
            throw new ForbiddenException('Admin ID missing in token.');
        }

        const deletedCategory =
            await this.service.deleteByAdmin(id /*, adminId */);

        return {
            message: 'Sub experiential event category deleted successfully.',
            data: deletedCategory,
        };
    }
}
