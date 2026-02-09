import {
    Body,
    Controller,
    Post,
    Get,
    Query,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';

import { ContactUsService } from './contact-us.service';
import { CreateContactUsDto } from './dto/create-contact-us.dto';
import { AdminListContactUsDto } from './dto/admin-list-contact-us.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Contact Us')
@Controller('contact-us')
export class ContactUsController {
    constructor(private readonly contactUsService: ContactUsService) { }

    // ─────────── User: Create Contact Us ───────────
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() dto: CreateContactUsDto) {
        const result = await this.contactUsService.create(dto);
        return {
            message: 'Contact request submitted successfully.',
            data: result,
        };
    }

    // ─────────── Admin: Get All Contact Requests ───────────
    @Get('admin')

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')

    async getAll(@Query() query: AdminListContactUsDto) {
        return this.contactUsService.getAll(query);
    }

}
