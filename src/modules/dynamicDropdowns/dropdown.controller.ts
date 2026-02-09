import { Controller, Post, Body, Get, Query, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { DropdownService } from './dropdown.service';
import { CreateDropdownOptionDto } from './dto/create-dropdown-option.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import pick from '../../common/utils/pick.util';
@Controller('dropdowns')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('admin')
export class DropdownController {
    constructor(private readonly dropdownService: DropdownService) { }

    @Post()
    async create(@Body() dto: CreateDropdownOptionDto) {
        return this.dropdownService.createOption(dto);
    }

    @Get()
    async findAll(@Query() query: any) {
        const filters = pick(query, ['type', 'value', 'label']);
        const options = pick(query, ['page', 'limit', 'sortBy', 'populate']);
        return this.dropdownService.getOptions({ ...filters, ...options });
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: Partial<CreateDropdownOptionDto>) {
        return this.dropdownService.updateOption(id, dto);
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.dropdownService.deleteOption(id);
    }
}