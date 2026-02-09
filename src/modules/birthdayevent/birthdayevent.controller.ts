import {
    Controller,
    Post,
    Body,
    UseGuards,
    Req,
    UploadedFiles,
    UseInterceptors,
    ValidationPipe,
    BadRequestException,
    Get,
    Query,
    Patch,
    Param,
    Delete,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { BirthdayEventService } from './birthdayevent.service';
import { CreateBirthdayEventDto } from './dto/create-birthdayevent.dto';
import { UpdateBirthdayEventDto } from './dto/update-birthdayevent.dto';
import { AdminQueryBirthdayEventDto } from './dto/admin-query-birthdayevent.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { uploadImageToS3 } from '../../common/utils/s3-upload.util';
import pick from '../../common/utils/pick.util';
import { EventIdParamDto } from './dto/event-id-param.dto';

@Controller('birthday-events')
export class BirthdayEventController {
    constructor(private readonly birthdayEventService: BirthdayEventService) { }

    // ---------------- CREATE EVENT ----------------
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'banner', maxCount: 10 }]))
    async create(
        @Body(new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
            transformOptions: { enableImplicitConversion: false }
        })) createBirthdayEventDto: CreateBirthdayEventDto,   // 👈 specific body pipe here
        @UploadedFiles() files: { banner?: Express.Multer.File[] },
        @Req() req,
    ) {
        console.log("🔥 Received Body:", req.body);
        console.log("📌 DTO After Transform:", createBirthdayEventDto);

        if (!files?.banner?.length) {
            throw new BadRequestException('At least one banner image is required');
        }

        const bannerUrls = await Promise.all(
            files.banner.map((file, i) =>
                uploadImageToS3({
                    fileBuffer: file.buffer,
                    key: `birthday-events/${createBirthdayEventDto.title}-${Date.now()}-${i}-${file.originalname}`,
                    contentType: file.mimetype,
                }),
            ),
        );

        createBirthdayEventDto.banner = bannerUrls;

        if (createBirthdayEventDto.ageGroup === 'kids' && !createBirthdayEventDto.subCategory) {
            throw new BadRequestException('Sub category required for kids events');
        }

        return this.birthdayEventService.create(createBirthdayEventDto, req.user);
    }





    // ---------------- FIND ALL ----------------
    @Get()
    async findAll(@Query() query: any) {
        const filters = pick(query, [
            'title',
            'ageGroup',
            'tiers',
            'active',
            'priceRange',
            'eventDate',
            'isShowcaseEvent',
            'subCategory',
            'totalBookings',
            'city',
        ]);
        const options = pick(query, ['page', 'limit', 'sortBy', 'populate']);
        return this.birthdayEventService.findAll({ ...filters, ...options });
    }

    // ────────────────────────────────────────────────────────────────
    // 🧩 ADMIN: Get All Birthday Events
    // ────────────────────────────────────────────────────────────────
    @Get('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async findAllForAdmin(@Query() query: AdminQueryBirthdayEventDto) {
        const events = await this.birthdayEventService.findAllForAdmin(query);
        return {
            message: 'All birthday events fetched successfully.',
            data: events,
        };
    }

    @Get('selected-fields')
    async findAllWithSelectedField() {
        return this.birthdayEventService.findAllWithSelected();
    }

    // ---------------- FIND ONE ----------------
    @Get(':eventId')
    async findOne(@Param() params: EventIdParamDto) {
        const { eventId } = params;
        const event = await this.birthdayEventService.findById(eventId);
        if (!event) throw new BadRequestException('Event not found');
        return { event };
    }

    // ---------------- UPDATE ACTIVE ----------------
    @Patch(':eventId/active')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async updateActiveStatus(@Param('eventId') eventId: string) {
        return this.birthdayEventService.updateActive(eventId);
    }
    // ---------------- UPDATE SHOW-    case ----------------
    @Patch(':eventId/showcase')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async updateShowCaseStatus(@Param('eventId') eventId: string) {
        return this.birthdayEventService.updateShowCase(eventId);
    }

    // ---------------- UPDATE EVENT ----------------
    @Patch(':eventId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'banner', maxCount: 10 }]))
    async update(
        @Param() params: EventIdParamDto,
        @Body() updateBirthdayEventDto: UpdateBirthdayEventDto,
        @UploadedFiles() files: { banner?: Express.Multer.File[] },
    ) {
        const { eventId } = params;

        if (files?.banner?.length) {
            const bannerUrls = await Promise.all(
                files.banner.map((file, index) =>
                    uploadImageToS3({
                        fileBuffer: file.buffer,
                        key: `birthday-events/${updateBirthdayEventDto.title || 'update'}-${Date.now()}-${index}-${file.originalname}`,
                        contentType: file.mimetype,
                    }),
                ),
            );
            updateBirthdayEventDto.addBanner = bannerUrls;
        }

        return this.birthdayEventService.update(eventId, updateBirthdayEventDto);
    }

    // ---------------- REMOVE IMAGE ----------------
    @Patch(':eventId/remove-image')
    async removeImage(@Param('eventId') eventId: string, @Body('imageUrl') imageUrl: string) {
        return this.birthdayEventService.removeImage(eventId, imageUrl);
    }

    @Delete(':eventId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async deleteEvent(@Param('eventId') eventId: string) {
        return this.birthdayEventService.deleteEvent(eventId);
    }

}
