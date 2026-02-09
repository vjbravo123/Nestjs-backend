import { Controller, Post, Body, Delete, UseGuards, Req, NotFoundException, UploadedFiles, UseInterceptors, BadRequestException, Get, Query, Patch, Param, Put } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ExperientialEventService } from './experientialevent.service';
import { CreateExperientialEventDto, EventIdParamDto, AdminApprovalDto } from './dto/create-experientialevent.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { uploadImageToS3 } from '../../common/utils/s3-upload.util';
import { Roles } from '../../common/decorators/roles.decorator';
import pick from '../../common/utils/pick.util';
import { EventOwnerGuard } from './experientialevent-owner.guard';
import { EventChangeHistoryService } from '../event-change-history/event-change-history.service';
import { Types } from 'mongoose';
import { UpdateExperientialEventDto, AddBannerByAdminDto, UpdateExperientialEventByVendorDto, UpdateExperientialEventByAdminDto, DeleteBannerDto } from "./dto/update-experientialevent.dto";
// import { Types } from 'joi';
@Controller('experiential-events')
export class ExperientialEventController {
    constructor(private readonly experientialEventService: ExperientialEventService,

        private readonly eventChangeHistoryService: EventChangeHistoryService
    ) { }


    // 🔹 Vendor creates an event (goes to pendingChanges first)
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin', 'vendor')
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'banner', maxCount: 10 }, // Allow up to 10 banner images
        ]),
    )
    async create(
        @Body() dto: CreateExperientialEventDto,
        @UploadedFiles() files: { banner?: Express.Multer.File[] },
        @Req() req,
    ) {
        if (!files.banner?.length) {
            throw new BadRequestException('At least one banner image is required');
        }

        const bannerUrls = await Promise.all(
            files.banner.map((file, index) =>
                uploadImageToS3({
                    fileBuffer: file.buffer,
                    key: `experiential-events/${dto.title}-${Date.now()}-${index}-${file.originalname}`,
                    contentType: file.mimetype,
                }),
            ),
        );

        // if (dto.ageGroup === 'kids' && !dto.subCategory) {
        //     throw new BadRequestException('Sub category required');
        // }
        type CreateEventInput = CreateExperientialEventDto & { banner: string[] };
        // ✅ Create enriched data (no mutation)
        const enrichedData: CreateEventInput = {
            ...dto,
            banner: bannerUrls,
        };
        // console.log("enrichedData", enrichedData);
        return this.experientialEventService.create(enrichedData, req.user);

    }



    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async findAllByAdmin(@Query() query: any) {
        const filter = pick(query, ['title', 'city', 'coreActivity', 'isActive', 'experientialEventCategoryId', 'subExperientialEventCategoryId',
            'createdBy', 'isVerify', 'eventUpdateStatus', 'priceRange', 'eventDate', 'isShowcaseEvent', 'totalBookings']);
        const options = pick(query, ['page', 'limit', 'sortBy']);
        return this.experientialEventService.getExperientialEventListByAdmin({ ...filter, ...options });
    }

    // 🔹 Vendor submits event update (goes into pendingChanges)
    // 🔹 Admin edits vendor-submitted pending changes
    @Put(':eventId/admin-edit')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'banner', maxCount: 10 }]))
    async updateByAdmin(
        @Param() params: EventIdParamDto,
        @Body() updateDto: UpdateExperientialEventByAdminDto,
        @UploadedFiles() files: { banner?: Express.Multer.File[] },
        @Req() req,
    ) {

        console.log("updateDto by admin", updateDto)
        const { eventId } = params;
        const adminId = req.user?.adminId;

        if (!adminId) {
            throw new BadRequestException('Admin authentication required');
        }

        // Build updated data object (immutable)
        let enrichedData = { ...updateDto };

        if (files?.banner?.length) {
            const bannerUrls = await Promise.all(
                files.banner.map((file, index) =>
                    uploadImageToS3({
                        fileBuffer: file.buffer,
                        key: `experiential-events/${updateDto.title || 'update'}-${Date.now()}-${index}-${file.originalname}`,
                        contentType: file.mimetype,
                    }),
                ),
            );

            enrichedData = { ...updateDto, banner: bannerUrls };
        }

        return this.experientialEventService.adminUpdateEvent(eventId, enrichedData, adminId);
    }



    // @Put(':eventId/vendor-edit')
    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles('admin')
    // @UseInterceptors(
    //     FileFieldsInterceptor([{ name: 'banner', maxCount: 10 }]),
    // )
    // async updateEventByVendor(
    //     @Param() params: EventIdParamDto,
    //     @Body() updateExperientialEventVendorDto: UpdateExperientialEventByVendorDto,
    //     @UploadedFiles() files: { banner?: Express.Multer.File[] },
    //     @Req() req,
    // ) {
    //     const { eventId } = params;

    //     let enrichedData = {};

    //     if (files?.banner?.length) {
    //         const bannerUrls = await Promise.all(
    //             files.banner.map((file, index) =>
    //                 uploadImageToS3({
    //                     fileBuffer: file.buffer,
    //                     key: `experiential-events/${updateExperientialEventVendorDto.title || 'update'}-${Date.now()}-${index}-${file.originalname}`,
    //                     contentType: file.mimetype,
    //                 }),
    //             ),
    //         );
    //         updateExperientialEventVendorDto.addBanner = bannerUrls
    //         enrichedData = { ...updateExperientialEventVendorDto };
    //         // ✅ build a new enriched object (no mutation)
    //         enrichedData = {
    //             ...updateExperientialEventVendorDto,


    //         };
    //     }

    //     return this.experientialEventService.adminUpdateEvent(eventId, enrichedData, req.user.adminId);
    // }


    // 🔹 Vendor checks their event status
    @Get(':eventId/status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async getUpdateStatus(@Param('eventId') eventId: string, @Req() req) {
        console.log("event status called");
        const event = await this.experientialEventService.getEventWithPendingChanges(eventId);
        if (!event) throw new NotFoundException('Event not found');
        return {
            eventUpdateStatus: event.eventUpdateStatus,
            pendingChanges: event.pendingChanges,
            lastUpdated: event.pendingChanges?.updatedAt,
        };
    }

    // 🔹 Admin: list all pending events
    @Get('pending/approvals')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async getPendingEvents(@Query() query: any) {
        const options = pick(query, ['page', 'limit', 'sortBy']);
        return this.experientialEventService.getPendingEvents(options);
    }

    // 🔹 Admin: approve or reject event
    @Patch(':eventId/approve')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async approveEvent(
        @Param('eventId') eventId: string,
        @Body() adminApprovalDto: AdminApprovalDto,
        @Req() req,
    ) {

        console.log("approveEvent called", req.user);
        if (adminApprovalDto.action === 'approved') {
            const approved = await this.experientialEventService.approveUpdate(eventId, req.user.adminId,);
            return {
                message: 'Event approved successfully',
                data: approved,
            };
        } else {
            const rejected = await this.experientialEventService.rejectUpdate(
                eventId,
                adminApprovalDto.reason || 'Event update rejected',
                req.user.userId,
            );
            return {
                message: 'Event update rejected',
                data: rejected,
            };
        }
    }

    // 🔹 Admin: view complete event (approved + pending)
    @Get(':eventId/complete')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async getCompleteEvent(@Param('eventId') eventId: string) {

        const event = await this.experientialEventService.getEventWithPendingChanges(eventId);

        if (!event) throw new NotFoundException('Event not found');

        return event
    }
    @Get(':eventId/public')
    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles('admin')
    async getEventByIdForPublic(@Param('eventId') eventId: string) {

        const event = await this.experientialEventService.getPublishedEvent(eventId);

        if (!event) throw new NotFoundException('Event not found');

        return event
    }


    // 🔹 Public: list only approved events
    @Get('public/list')
    async listApprovedEvents(@Query() query: any) {
        const filters = pick(query, [
            'title',
            'experientialEventCategory',
            'tiers',
            'active',
            "isShowcaseEvent",
            'priceRange',
            'eventDate',
            'subExperientialEventCategory',
            'totalBookings',
            'city',
        ]);
        const options = pick(query, ['page', 'limit', 'sortBy', 'populate']);
        return this.experientialEventService.listApprovedEvents({ ...filters, ...options });
    }
    @Get('vendor/list')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async getVendorsEventByToken(@Query() query: any, @Req() req) {
        const filters = pick(query, [
            'title',
            'experientialEventCategory',
            'tiers',
            'active',
            'priceRange',
            'eventDate',
            'subExperientialEventCategory',
            'totalBookings',
            'isShowcaseEvent',
            'city',
        ]);

        const options = pick(query, ['page', 'limit', 'sortBy', 'populate']);

        // vendorId comes from JWT payload
        const vendorId = req.user.vendorId;

        return this.experientialEventService.listEventsByVendor(vendorId, filters, options);
    }

    // 🔹 Public: get single approved event
    @Get('public/:eventId')
    async getApprovedEvent(@Param('eventId') eventId: string) {
        const event = await this.experientialEventService.getApprovedEventById(eventId);
        if (!event) throw new NotFoundException('Event not found or not approved');
        return {
            message: 'Event retrieved successfully',
            data: event,
        };
    }



    // experiential-event.controller.ts
    //edit by vendor
    @Patch(':eventId/edit')
    @UseGuards(JwtAuthGuard, RolesGuard, EventOwnerGuard)
    @Roles('vendor')
    @UseInterceptors(
        FileFieldsInterceptor([{ name: 'banner', maxCount: 10 }]),
    )
    async submitEventEdit(
        @Param('eventId') eventId: string,
        @Body() updateEventDto: UpdateExperientialEventByVendorDto,
        @Req() req,
        @UploadedFiles() files?: { banner?: Express.Multer.File[] },
    ) {
        // ✅ Reuse event fetched by EventOwnerGuard
        const event = req.event;

        // ✅ Handle banner uploads
        if (files?.banner?.length) {
            const bannerUrls = await Promise.all(
                files.banner.map(async (file, index) => {
                    const s3Url = await uploadImageToS3({
                        fileBuffer: file.buffer,
                        key: `experiential-events/${eventId}-${Date.now()}-${index}-${file.originalname}`,
                        contentType: file.mimetype,
                    });

                    return s3Url;
                }),
            );

            updateEventDto.addBanner = bannerUrls;
        }



        // ✅ Service handles only data updates, not ownership
        const updatedEvent = await this.experientialEventService.submitEventEditInstance(
            event,
            updateEventDto,
            req.user.vendorId,
        );

        return {
            message: 'Event update submitted for admin approval',
            data: {
                eventId: updatedEvent._id,
                eventUpdateStatus: updatedEvent.eventUpdateStatus,
                pendingChanges: updatedEvent.pendingChanges,
            },
        };
    }



    @Get(':eventId/details')
    @UseGuards(JwtAuthGuard, RolesGuard, EventOwnerGuard)
    @Roles('vendor')
    @UseInterceptors(
        FileFieldsInterceptor([{ name: 'banner', maxCount: 10 }]),
    )
    async getEventByVendor(
        @Param('eventId') eventId: string,
        // @Body() updateEventDto: UpdateExperientialEventDto,
        @Req() req,
        // @UploadedFiles() files?: { banner?: Express.Multer.File[] },
    ) {
        // ✅ Reuse event fetched by EventOwnerGuard
        const event = req.event;

        // ✅ Handle banner uploads




        return {
            message: 'Event details fetched successfully',
            data: {
                event: event,
            },
        };
    }




    @Get(':eventId/details-edit')
    @UseGuards(JwtAuthGuard, RolesGuard, EventOwnerGuard)
    @Roles('vendor')
    @UseInterceptors(
        FileFieldsInterceptor([{ name: 'banner', maxCount: 10 }]),
    )
    async getEventByVendorForEdit(
        @Param('eventId') eventId: string,
        @Req() req,
    ) {
        let event = req.event;
        console.log("Fetched event for edit: ", event);
        event = await this.experientialEventService.getByIdWithAggregate(eventId);
        console.log("Fetched event with aggregate for edit: ", event);
        if (event.isVerify === false && event.eventUpdateStatus === 'pending') {
            console.log("getting pending changes for event", event.id);
            event = {
                ...event,
                ...event.pendingChanges,

            };
            delete event.pendingChanges;


        } else if (event.isVerify === false && event.eventUpdateStatus === 'rejected') {


            console.log("getting rejected changes for event", event.id);
            console.log("getting rejected changes for event id", event.id);
            let convertIntoArray = event.id.split(" ");
            // ✅ Don't split; just pass the string or ObjectId
            const rejectedChanges = await this.eventChangeHistoryService.getLastRejectedChanges(convertIntoArray);

            console.log("rejectedChanges in history:", rejectedChanges);

            // ✅ Extract the nested data correctly
            const rejectedData = rejectedChanges[event.id]; // the inner object

            if (rejectedData?.lastRejectedChanges) {
                console.log("Merging rejected data into event...");

                event = {
                    ...event,
                    ...rejectedData.lastRejectedChanges,
                    eventUpdateReason: rejectedData.lastRejectedReason, // optional
                };
            }
        }


        return {
            message: 'Event details fetched successfully',
            data: event,
        };
    }


    @Patch(':eventId/active')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async updateActiveStatus(
        @Param('eventId') eventId: string,
    ) {
        return this.experientialEventService.updateActive(eventId);
    }



    @Patch(':eventId/show-case')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async updateShowCaseStatus(
        @Param('eventId') eventId: string,
    ) {
        return this.experientialEventService.updateShowCase(eventId);
    }




    @Patch(':eventId/block')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async updateBlockStatus(
        @Param('eventId') eventId: string,
    ) {
        return this.experientialEventService.updateBlock(eventId);
    }
    @Patch(':eventId/addOns')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async updateAddOns(
        @Param('eventId') eventId: string,
        @Body() dto: { addOns: Types.ObjectId[] },

    ) {

        if (!dto.addOns || !Array.isArray(dto.addOns) || dto.addOns.length === 0) {
            throw new BadRequestException('addOns must be a non-empty array of ObjectId strings');
        }
        return this.experientialEventService.updateAddOns(eventId, dto.addOns);
    }


    @Post('admin/:eventId/banner')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'banner', maxCount: 5 }]))
    async addBannerByAdmin(
        @Param('eventId') eventId: string,
        @UploadedFiles() files: { banner?: Express.Multer.File[] },
        @Req() req,
    ) {
        if (!files?.banner?.length) {
            throw new NotFoundException('No banner files uploaded');
        }

        const bannerUrls = await Promise.all(
            files.banner.map((file, index) =>
                uploadImageToS3({
                    fileBuffer: file.buffer,
                    key: `experiential-events/admin-upload-${Date.now()}-${index}-${file.originalname}`,
                    contentType: file.mimetype,
                }),
            ),
        );

        return this.experientialEventService.addBannerByAdmin(
            eventId,
            bannerUrls,
            req.user.adminId,
        );
    }


    @Delete('admin/:eventId/banner')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async removeBannerByAdmin(
        @Param('eventId') eventId: string,
        @Body() dto: DeleteBannerDto,
        @Req() req,
    ) {
        if (!dto.bannerUrl) {
            throw new NotFoundException('Banner URL is required');
        }

        return this.experientialEventService.removeBannerByAdmin(
            eventId,
            dto.bannerUrl,
            req.user.adminId,
        );
    }
}