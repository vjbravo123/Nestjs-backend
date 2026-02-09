import {
    Controller, Post, Body, UseGuards, Req, Delete, UploadedFiles, UseInterceptors, BadRequestException, Get, Query,
    Patch, NotFoundException, ForbiddenException,
    Param,
} from '@nestjs/common';
import { AddOnService } from './addon.service';
import { CreateAddOnDto } from './dto/create-addon.dto';
import { UpdateAddOnDto } from './dto/update-addon.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { uploadImageToS3 } from '../../common/utils/s3-upload.util';
import { Roles } from '../../common/decorators/roles.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

import { AdminApprovalDto, AdminQueryAddOnDto, RemoveBannerAddOnDto, UpdatePendingAddOnDto } from './dto/admin-addons.dto'; // 🔹 create this DTO
import { VendorQueryAddOnDto } from './dto/vendor-addons.dto';
import { PublicQueryAddOnDto } from './dto/public-query-addon.dto';
import pick from 'src/common/utils/pick.util';
import { Types } from 'mongoose';
import { AuthUser } from 'src/modules/auth/types/auth-user.type';
import { VendorEditAddOnDto } from './dto/update-addon.dto';
import { deleteImageFromS3 } from '../../common/utils/s3-upload.util';
import { Admin } from 'src/modules/admin/admin.schema';
@Controller('addons')

export class AddOnController {
    constructor(private readonly addOnService: AddOnService) { }

    // ────────────────────────────────────────────────────────────────
    // 🧩 ADMIN / VENDOR: Create Add-On (Pending Review)
    // ────────────────────────────────────────────────────────────────
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin', 'vendor')
    @UseInterceptors(
        FileFieldsInterceptor([{ name: 'banner', maxCount: 15 }]),
    )
    async create(
        @Body() dto: CreateAddOnDto,
        @UploadedFiles() files: { banner?: Express.Multer.File[] },
        @CurrentUser() user: AuthUser,
    ) {
        if (!files?.banner?.length) {
            throw new BadRequestException('At least one banner image is required.');
        }

        const vendorId = user?.vendorId;
        if (!vendorId) {
            throw new ForbiddenException('Vendor ID missing from your token.');
        }

        const bannerUrls = await Promise.all(
            files.banner.map((file, index) =>
                uploadImageToS3({
                    fileBuffer: file.buffer,
                    key: `addons/${dto.name}-${Date.now()}-${index}-${file.originalname}`,
                    contentType: file.mimetype,
                }),
            ),
        );

        const enrichedData: CreateAddOnDto & { banner: string[] } = {
            ...dto,
            banner: bannerUrls,
        };

        const result = await this.addOnService.create(enrichedData, vendorId);
        return {
            message: 'Add-On created successfully (pending approval).',
            data: result,
        };
    }

    // ────────────────────────────────────────────────────────────────
    // 🧩 ADMIN: Get All Add-Ons
    // ────────────────────────────────────────────────────────────────
    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async getAllAddOns(@Query() query: AdminQueryAddOnDto) {
        console.log("query from admin addon", query);
        const addons = await this.addOnService.getAddOnsListByAdmin(query);
        return {
            message: 'All add-ons fetched successfully.',
            // count: addons.length,
            data: addons,
        };
    }

    // ────────────────────────────────────────────────────────────────
    // 🧩 ADMIN: Get Add-On Details by ID
    // ────────────────────────────────────────────────────────────────
    @Get('admin/:addOnId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async getAddOnDetailsByAdmin(@Param('addOnId') addOnId: string) {
        if (!Types.ObjectId.isValid(addOnId)) {
            throw new NotFoundException('Invalid Add-On ID.');
        }

        const addOn = await this.addOnService.getAddOnDetailsByAdmin(addOnId);
        if (!addOn) {
            throw new NotFoundException('Add-On not found.');
        }

        return {
            message: 'Add-On details fetched successfully.',
            data: addOn,
        };
    }

    // ────────────────────────────────────────────────────────────────
    // 🧩 ADMIN: Approve / Reject Add-On Changes
    // ────────────────────────────────────────────────────────────────
    @Post(':addOnId/approval')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async approveOrRejectAddOn(
        @Param('addOnId') addOnId: string,
        @Body() dto: AdminApprovalDto,
        @CurrentUser() user: AuthUser,
    ) {
        if (!Types.ObjectId.isValid(addOnId)) {
            throw new BadRequestException('Invalid Add-On ID.');
        }

        const adminId = user?.adminId;
        if (!adminId) {
            throw new ForbiddenException('Admin ID missing in token.');
        }

        if (dto.action === 'approved') {
            const result = await this.addOnService.approveAddOn(addOnId, adminId);
            return {
                message: 'Add-On approved successfully.',
                data: result,
            };
        }

        if (dto.action === 'rejected') {
            const result = await this.addOnService.rejectAddOn(
                addOnId,
                dto.reason || 'Changes rejected by admin.',
                adminId,
            );
            return {
                message: 'Add-On rejected successfully.',
                data: result,
            };
        }

        throw new BadRequestException('Invalid approval action.');
    }

    /**
     * @route PATCH /addons/:eventId/pending
     * @description Admin-only: Update pending changes for an Add-On
     * @access Admin
     */
    @Patch(':eventId/pending')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async updatePendingAddOnByAdmin(
        @Param('eventId') eventId: string,
        @Body() dto: UpdatePendingAddOnDto,
        @CurrentUser() user: AuthUser,
    ) {
        if (!Types.ObjectId.isValid(eventId)) {
            throw new BadRequestException('Invalid Add-On ID');
        }

        const adminId = user?.adminId;
        if (!adminId) {
            throw new ForbiddenException('Admin ID missing in token.');
        }

        const updatedAddOn = await this.addOnService.updatePendingAddOnByAdmin(
            eventId,
            dto,
            adminId,
        );

        return {
            message: 'Pending changes updated successfully.',
            data: updatedAddOn,
        };
    }






    @Patch(':addOnId/block')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async toggleBlockByAdmin(
        @Param('addOnId') addOnId: string,
        @CurrentUser() user: AuthUser,
    ) {
        // ✅ Defensive conversion for safety
        const adminObjectId =
            user.adminId instanceof Types.ObjectId
                ? user.vendorId
                : new Types.ObjectId(user.adminId);

        return this.addOnService.toggleBlockByAdmin(addOnId);
    }





    // ────────────────────────────────────────────────────────────────
    // 🧩 VENDOR: Toggle Add-On Active Status
    // ────────────────────────────────────────────────────────────────
    @Patch(':addOnId/active')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async toggleActiveByVendor(
        @Param('addOnId') addOnId: string,
        @CurrentUser() user: AuthUser,
    ) {
        // ✅ Defensive conversion for safety
        const vendorObjectId =
            user.vendorId instanceof Types.ObjectId
                ? user.vendorId
                : new Types.ObjectId(user.vendorId);

        return this.addOnService.toggleActiveByVendor(addOnId, vendorObjectId);
    }



    /**
     * ✅ Admin: Upload one or more banner images for an Add-On
     */
    @Post(':addOnId/banner')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'banner', maxCount: 10 }]))
    async uploadAddOnBanner(
        @Param('addOnId') addOnId: string,
        @UploadedFiles() files: { banner?: Express.Multer.File[] },
    ) {
        // 🔍 Validate ID
        if (!Types.ObjectId.isValid(addOnId)) {
            throw new BadRequestException('Invalid Add-On ID');
        }

        // 🔍 Validate files
        if (!files.banner?.length) {
            throw new BadRequestException('No banner files provided');
        }

        // 🧩 Find existing Add-On
        const addOn = await this.addOnService.getAddonById(addOnId);
        if (!addOn) {
            throw new NotFoundException('Add-On not found');
        }

        // ☁️ Upload all banners to S3
        const uploadedUrls = await Promise.all(
            files.banner.map((file, index) =>
                uploadImageToS3({
                    fileBuffer: file.buffer,
                    key: `addons/admin-addons/${addOnId}/banner-${Date.now()}-${index}-${file.originalname}`,
                    contentType: file.mimetype,
                }),
            ),
        );

        // 🧾 Update banner array
        addOn.banner = [...uploadedUrls, ...(addOn.banner || [])];
        await addOn.save();

        return {
            message: 'Banners uploaded successfully',
            data: {
                addOnId,
                banners: addOn.banner,
            },
        };
    }


    /**
   * ✅ Admin: Remove a banner from event or pendingChanges
   * DELETE /events/:eventId/banner
   */
    @Delete(':eventId/banner')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async removeBannerByAdmin(
        @Param('eventId') eventId: string,
        @Body() dto: RemoveBannerAddOnDto,
        @CurrentUser() user: any, // includes adminId
    ) {
        if (!Types.ObjectId.isValid(eventId)) {
            throw new BadRequestException('Invalid event ID');
        }
        const { bannerToRemove } = dto;
        if (!bannerToRemove) {
            throw new BadRequestException('Banner URL is required');
        }

        const adminId = user?.adminId || user?._id;
        if (!adminId) {
            throw new BadRequestException('Invalid admin user context');
        }

        const updatedEvent = await this.addOnService.removeBannerByAdmin(
            eventId,
            bannerToRemove,
            adminId,
        );

        return {
            message: 'Banner removed successfully',
            data: updatedEvent,
        };
    }






    // ────────────────────────────────────────────────────────────────
    // 🧩 PUBLIC: List & Fetch Public Add-Ons
    // ────────────────────────────────────────────────────────────────
    @Get('public')
    async getPublicAddOns(@Query() query: PublicQueryAddOnDto) {
        const addons = await this.addOnService.getPublicAddOns(query);

        return {
            message: 'Public add-ons fetched successfully.',
            count: addons?.results?.length || 0,
            data: addons,
        };
    }



    @Get(':addOnId/public')
    async getPublicAddOnById(@Param('addOnId') addOnId: string) {
        if (!Types.ObjectId.isValid(addOnId)) {
            throw new NotFoundException('Invalid Add-On ID.');
        }

        const addOn = await this.addOnService.getPublicAddOnById(addOnId);
        if (!addOn) {
            throw new NotFoundException('Add-On not found.');
        }

        return {
            message: 'Public Add-On details fetched successfully.',
            data: addOn,
        };
    }

    // ────────────────────────────────────────────────────────────────
    // 🧩 VENDOR: Get All Add-Ons for the Logged-In Vendor
    // ────────────────────────────────────────────────────────────────
    @Get('vendor')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async getVendorAddOns(
        @CurrentUser() user: AuthUser,
        @Query() query: VendorQueryAddOnDto,
    ) {
        if (!user?.vendorId) {
            throw new ForbiddenException('Vendor ID missing from your token.');
        }

        const addons = await this.addOnService.getAddOnsListByVendor(
            user.vendorId.toString(),
            query,
        );

        return {
            message: 'Vendor add-ons fetched successfully.',
            data: addons,
        };
    }

    // ────────────────────────────────────────────────────────────────
    // 🧩 VENDOR: Get Single Add-On by ID (Owned by Vendor)
    // ────────────────────────────────────────────────────────────────



    @Get(':addOnId/vendor')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async getVendorAddOnById(
        @Param('addOnId') addOnId: string,
        @CurrentUser() user: AuthUser,
    ) {
        if (!user?.vendorId) {
            throw new ForbiddenException('Vendor ID missing in token.');
        }

        if (!Types.ObjectId.isValid(addOnId)) {
            throw new NotFoundException('Invalid Add-On ID.');
        }

        const addOn = await this.addOnService.getAddOnDetailsForVendor(
            addOnId,
            user.vendorId.toString(),
        );

        if (!addOn) {
            throw new NotFoundException('Add-On not found or access denied.');
        }

        return {
            message: 'Add-On details fetched successfully.',
            data: addOn,
        };
    }

    @Get(':addOnId/edit')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async getAddOnForEdit(
        @Param('addOnId') addOnId: string,
        @Req() req: any,
    ) {
        const vendorId = req.user.vendorId;
        return this.addOnService.getAddOnForEdit(addOnId, vendorId);
    }


    @Patch(':addonId/edit')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(
        FileFieldsInterceptor([{ name: 'banner', maxCount: 15 }]),
    )
    @Roles('vendor')
    async editAddOn(
        @Param('addonId') addOnId: string,
        @UploadedFiles() files: { banner?: Express.Multer.File[] },
        @Body() dto: VendorEditAddOnDto,
        @CurrentUser() user: AuthUser,
    ) {

        if (files?.banner?.length) {
            const bannerUrls = await Promise.all(
                files.banner.map((file, index) =>
                    uploadImageToS3({
                        fileBuffer: file.buffer,
                        key: `addons/${dto.name || 'update'}-${Date.now()}-${index}-${file.originalname}`,
                        contentType: file.mimetype,
                    }),
                ),
            );
            dto.addBanner = bannerUrls;
        }

        const vendorId = new Types.ObjectId(user.vendorId);
        return this.addOnService.editAddOnByVendor(
            new Types.ObjectId(addOnId),
            vendorId,
            dto,
        );
    }












    // Vendor: Edit AddOn (pendingChanges)
    @Patch('vendor/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async updateByVendor(@Param('id') id: string, @Body() dto: UpdateAddOnDto, @Req() req) {
        return this.addOnService.updateByVendor(id, dto, req.user.vendorId);
    }

    // Vendor: Toggle active/inactive






    // Vendor: Get their pending AddOns
    @Get('vendor/pending')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async getVendorPendingAddOns(@Req() req) {
        return this.addOnService.getVendorPendingAddOns(req.user.vendorId);
    }

    // Admin: Approve/Reject AddOn
    @Patch(':id/approve')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async approveAddOn(@Param('id') id: string, @Body() dto: AdminApprovalDto, @Req() req) {
        if (dto.action === 'approved') {
            return this.addOnService.approveAddOn(id, req.user.vendorId, dto.reason);
        } else {
            return this.addOnService.rejectAddOn(id, dto.reason || 'AddOn rejected', req.user.vendorId);
        }
    }

    // Admin: List all AddOns (with filters, pagination)
    @Get('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async listAllAddOns(@Query() query: any) {
        // Only allow certain filters and options from query
        const filters = pick(query, [
            'name',
            'category',
            'cityOfOperation',
            'price',
            'popular',
            'isActive',
            'updateStatus',
            'createdBy',
            // add more allowed filter fields as needed
        ]);
        const options = pick(query, ['page', 'limit', 'sortBy', 'populate']);
        return this.addOnService.findAll({ ...filters, ...options });
    }

    // Admin: List all pending AddOns
    @Get('admin/pending')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async listPendingAddOns(@Query() query: any) {
        return this.addOnService.findAll({ ...query, updateStatus: 'pending' });
    }

    // Public: List AddOns (selected fields only)
    @Get('public')
    async listAddonsForPublic(@Query() query: any) {
        // Only allow certain filters from query
        const filters = pick(query, ['name', 'category', 'cityOfOperation', 'price', 'popular', 'isActive', 'category', 'categoryId', 'addOns', 'date', 'tags']);
        const options = pick(query, ['page', 'limit', 'sortBy', 'populate']);
        return this.addOnService.listAddonsForPublic({ ...filters, ...options });
    }

    // and Vendor List all AddOns (with filters and options)
    // @Get()
    // async findAll(@Query() query: any) {
    //     // Only allow certain filters and options from query
    //     const filters = pick(query, [
    //         'name',
    //         'category',
    //         'cityOfOperation',
    //         'price',
    //         'popular',
    //         'addOns',

    //         'isActive',
    //         'updateStatus',
    //         'createdBy',
    //         // add more allowed filter fields as needed
    //     ]);
    //     const options = pick(query, ['page', 'limit', 'sortBy', 'populate']);
    //     return this.addOnService.findAll({ ...filters, ...options });
    // }
}
