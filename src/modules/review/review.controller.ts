import { Controller, Post, Body, Get, Param, Query, UseGuards, Req, Patch } from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { AdminUpdateReviewDto } from './dto/update-review.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
@Controller('reviews')
export class ReviewController {
    constructor(private readonly reviewService: ReviewService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('user')
    async create(@Body() createReviewDto: CreateReviewDto, @Req() req) {
        return this.reviewService.create(createReviewDto, req.user.userId);
    }

    @Patch("status/:id")
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async adminUpdateReview(
        @Param('id') reviewId: string,
        @Body() dto: AdminUpdateReviewDto,
        @Req() req,
    ) {
        return this.reviewService.adminUpdateReview(reviewId, dto, req.user.userId);
    }

    @Get()
    async getByEvent(@Query('event') eventId: string) {
        return this.reviewService.getByEvent(eventId);
    }
    @Get('list')
    async getReviews(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query() query: any,
    ) {
        // Remove pagination params from query object
        const { page: _page, limit: _limit, ...filters } = query;
        return this.reviewService.getReviews({
            page: Number(page),
            limit: Number(limit),
            filters,
        });
    }

    @Get('event/:eventId/overall-rating')
    async getEventOverallRating(@Param('eventId') eventId: string) {
        return this.reviewService.getEventOverallRating(eventId);
    }

}