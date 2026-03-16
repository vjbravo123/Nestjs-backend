import { Controller, Post, Body, Get, Put, Param, UseGuards, Patch, Query } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoryByEventDto } from './dto/get-category-by-eventid.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) { }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Get()
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin') // optional, remove if all users can view categories
  async findAll(@Query() query: any) {
    // pass query directly to service
    return this.categoryService.findAll(query);
  }
  @Get('event')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getCategoryByEventId(@Query() dto: CategoryByEventDto) {
    return this.categoryService.getCategoryByEventId(dto);
  }

  @Get('all')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin') // optional, remove if all users can view categories
  async getCategory(@Query() query: any) {
    // pass query directly to service
    return this.categoryService.getCategory(query);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')

  async update(@Param('id') id: string, @Body() dto: Partial<CreateCategoryDto>) {
    return this.categoryService.update(id, dto);
  }

  @Patch(':id/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async setActive(
    @Param('id') id: string,
    @Query('isActive') isActive: string,
  ) {
    const status = isActive === 'true';
    return this.categoryService.setActiveStatus(id, status);
  }
}
