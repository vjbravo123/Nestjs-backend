import { Controller, Post, Body, UseGuards, Req, Get, Query } from '@nestjs/common';
import { EventDetailService } from './eventdetail.service';
import { CreateEventDetailDto } from './dto/create-eventdetail.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('event-details')
export class EventDetailController {
    constructor(private readonly eventDetailService: EventDetailService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async create(@Body() createEventDetailDto: CreateEventDetailDto, @Req() req) {
        return this.eventDetailService.create(createEventDetailDto, req.user);
    }

    @Get()
    async getByType(@Query('type') type?: string) {
        return this.eventDetailService.getByType(type);
    }
}