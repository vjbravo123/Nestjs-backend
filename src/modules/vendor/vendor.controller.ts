import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFiles, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, Put, NotFoundException, UsePipes, ValidationPipe, BadRequestException, Req, Query } from '@nestjs/common';
import { VendorService } from './vendor.service';
import { CreateVendorDtoStep2, CreateVendorDtoStep3, UpdateVendorProfileDto, AdminApprovalDto } from './dto/vendor.dto';
import { Vendor } from './vendor.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { uploadImageToS3 } from '../../common/utils/s3-upload.util';
import logger from '../../common/utils/logger';
import pick from '../../common/utils/pick.util'
@Controller('vendors')
export class VendorController {
    constructor(private readonly vendorService: VendorService) { }

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async listVendors(@Query() query: any) {
        // pick only filterable fields
        const filters = pick(query, ['firstName', 'lastName', 'email', 'mobile', 'role', 'registrationStatus', 'search', 'isMobileVerify', 'category', 'isEmailVerify']);
        // pick pagination + sorting
        const options = pick(query, ['page', 'limit', 'sortBy']);
        const vendors = await this.vendorService.findAll({ ...filters, ...options });
        return vendors
    }


    @Get('public')
    async listVendorsForPublic(@Query() query: any) {
        const filters = pick(query, ['firstName', 'lastName', 'email', 'mobile', 'role', 'registrationStatus', 'search', 'isMobileVerify', 'isVerify', 'isEmailVerify']);
        const options = pick(query, ['page', 'limit', 'sortBy']);
        const vendors = await this.vendorService.listOfVendorForPublic({ ...filters, ...options });
        return vendors
    }

    @Patch(':vendorId/active')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async updateActiveStatus(
        @Param('vendorId') vendorId: string,
    ) {
        return this.vendorService.updateActive(vendorId);
    }


    @Patch(':vendorId/status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async approveVendorProfile(
        @Param('vendorId') vendorId: string,
        @Req() req
    ) {
        return this.vendorService.updateVendorStatus(vendorId, req.body);
    }



    @Patch('business-info')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'displayImages', maxCount: 10 }
        ])
    )
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async updateVendorStep2(

        @Body() createVendorDtoStep2: CreateVendorDtoStep2,
        @UploadedFiles() files: { displayImages?: any[] },
        @Req() req
    ) {


        const vendor = await this.vendorService.getVendorById(req.user.vendorId);
        if (!vendor) throw new NotFoundException('Vendor not found');
        // Handle file uploads for displayImages
        if (files) {
            const displayImagesArray = files.displayImages ?? [];
            // console.log(displayImagesArray);
            logger.info("displayImagesArray", displayImagesArray);
            if (!Array.isArray(displayImagesArray) || displayImagesArray.length < 1) {
                throw new NotFoundException('Images not in a array');
            } else {
                logger.info("your file not upload correctly:1", displayImagesArray);
            }
        } else {
            throw new NotFoundException('file is not present');
            logger.info("file not uploaded");
        }
        if (files?.displayImages && files.displayImages.length > 0) {
            // 🗂 Upload display images to S3 and collect URLs
            const imageUrls = await Promise.all(
                files.displayImages.map(async (file, index) => {
                    const s3Url = await uploadImageToS3({
                        fileBuffer: file.buffer,
                        key: `vendor-images/${req.user.vendorId}-${Date.now()}-${index}-${file.originalname}`,
                        contentType: file.mimetype,
                    });
                    return s3Url;
                })
            );

            // If there are existing images, append new ones, otherwise replace
            if (createVendorDtoStep2.displayImages && createVendorDtoStep2.displayImages.length > 0) {
                createVendorDtoStep2.displayImages = [...createVendorDtoStep2.displayImages, ...imageUrls];
            } else {
                createVendorDtoStep2.displayImages = imageUrls;
            }
        }

        createVendorDtoStep2.registrationStatus = 'in_progress';

        const updatedVendor = await this.vendorService.updateVendorDto(
            req.user.vendorId,
            createVendorDtoStep2,
        );

        return {
            message: 'Vendor Step 2 data updated successfully',
            data: updatedVendor,
        };
    }

    // Step 3 – Services & Terms
    @Patch('service-term')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async updateVendorStep3(
        // @Param('vendorId') vendorId: string,
        @Body() createVendorDtoStep3: CreateVendorDtoStep3,
        @Req() req
    ) {
        const vendor = await this.vendorService.getVendorById(req.user.vendorId);
        if (!vendor) throw new NotFoundException('Vendor not found');
        createVendorDtoStep3.registrationStatus = 'complete';
        const updatedVendor = await this.vendorService.updateVendorDto(
            req.user.vendorId,
            createVendorDtoStep3,
        );
        return {
            message: 'Vendor Step 3 data updated successfully',
            data: updatedVendor,
        };
    }

    // Profile Update Endpoints
    @Patch('profile/update')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'displayImages', maxCount: 10 }
        ])
    )
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async updateVendorProfile(
        @Body() updateVendorProfileDto: UpdateVendorProfileDto,
        @UploadedFiles() files: { displayImages?: any[] },
        @Req() req
    ) {
        // Handle file uploads for displayImages if provided
        if (files?.displayImages && files.displayImages.length > 0) {
            const imageUrls = await Promise.all(
                files.displayImages.map(async (file, index) => {
                    const s3Url = await uploadImageToS3({
                        fileBuffer: file.buffer,
                        key: `vendor-images/${req.user.vendorId}-${Date.now()}-${index}-${file.originalname}`,
                        contentType: file.mimetype,
                    });
                    return s3Url;
                })
            );

            // If there are existing images, append new ones, otherwise replace
            if (updateVendorProfileDto.displayImages && updateVendorProfileDto.displayImages.length > 0) {
                updateVendorProfileDto.displayImages = [...updateVendorProfileDto.displayImages, ...imageUrls];
            } else {
                updateVendorProfileDto.displayImages = imageUrls;
            }
        }

        const updatedVendor = await this.vendorService.submitProfileUpdate(
            req.user.vendorId,
            updateVendorProfileDto,
            req.user.vendorId
        );

        return {
            message: 'Profile update submitted for admin approval',
            data: {
                vendorId: updatedVendor._id,
                profileUpdateStatus: updatedVendor.profileUpdateStatus,
                pendingChanges: updatedVendor.pendingChanges
            },
        };
    }

    @Get('profile/complete')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async getVendorCompleteProfile(@Req() req) {
        const vendor = await this.vendorService.getVendorWithPendingChanges(req.user.vendorId);

        return {
            message: 'Vendor complete profile retrieved successfully',
            data: {
                // Current approved profile data
                currentProfile: {
                    _id: vendor._id,
                    firstName: vendor.firstName,
                    lastName: vendor.lastName,
                    email: vendor.email,
                    mobile: vendor.mobile,
                    businessName: vendor.businessName,
                    businessType: vendor.businessType,
                    subBusinessType: vendor.subBusinessType,
                    experience: vendor.experience,
                    city: vendor.city,
                    state: vendor.state,
                    zip: vendor.zip,
                    businessAddress: vendor.businessAddress,
                    businessDescription: vendor.businessDescription,
                    gstin: vendor.gstin,
                    displayImages: vendor.displayImages,
                    websiteUrl: vendor.websiteUrl,
                    socialMediaLinks: vendor.socialMediaLinks,
                    servicesOffered: vendor.servicesOffered,
                    isActive: vendor.isActive,
                    status: vendor.status,
                    registrationStatus: vendor.registrationStatus,
                    // createdAt: vendor.createdAt,
                    // updatedAt: vendor.updatedAt
                },
                // Pending changes (if any)
                pendingChanges: vendor.pendingChanges,
                profileUpdateStatus: vendor.profileUpdateStatus,
                profileUpdateReason: vendor.profileUpdateReason,
                lastUpdated: vendor.pendingChanges?.updatedAt
            }
        };
    }

    @Get('profile/status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('vendor')
    async getProfileUpdateStatus(@Req() req) {
        const vendor = await this.vendorService.getVendorWithPendingChanges(req.user.vendorId);

        return {
            profileUpdateStatus: vendor.profileUpdateStatus,
            pendingChanges: vendor.pendingChanges,
            profileUpdateReason: vendor.profileUpdateReason,
            lastUpdated: vendor.pendingChanges?.updatedAt
        };
    }

    // Admin Endpoints for Profile Approval
    @Get('pending-updates')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async getVendorsWithPendingUpdates(@Query() query: any) {
        const options = pick(query, ['page', 'limit', 'sortBy']);
        const vendors = await this.vendorService.getVendorsWithPendingUpdates(options);
        return vendors;
    }

    @Patch(':vendorId/profile/approve')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async approveVendorProfileUpdate(
        @Param('vendorId') vendorId: string,
        @Body() adminApprovalDto: AdminApprovalDto,
        @Req() req
    ) {
        if (adminApprovalDto.action === 'approved') {
            const updatedVendor = await this.vendorService.approveProfileUpdate(
                vendorId,
                req.user.vendorId,
                adminApprovalDto.reason
            );
            return {
                message: 'Vendor profile update approved successfully',
                data: updatedVendor
            };
        } else {
            const updatedVendor = await this.vendorService.rejectProfileUpdate(
                vendorId,
                adminApprovalDto.reason || 'Profile update rejected',
                req.user.vendorId
            );
            return {
                message: 'Vendor profile update rejected',
                data: updatedVendor
            };
        }
    }

    // Admin endpoint to get any vendor's complete profile
    @Get(':vendorId/complete')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async getVendorCompleteProfileAdmin(@Param('vendorId') vendorId: string) {
        const vendor = await this.vendorService.getVendorWithPendingChanges(vendorId);

        return {
            message: 'Vendor profile retrieved successfully',
            data: {
                // Current approved profile data
                currentProfile: {
                    _id: vendor._id,
                    firstName: vendor.firstName,
                    lastName: vendor.lastName,
                    email: vendor.email,
                    mobile: vendor.mobile,
                    businessName: vendor.businessName,
                    businessType: vendor.businessType,
                    subBusinessType: vendor.subBusinessType,
                    experience: vendor.experience,
                    city: vendor.city,
                    state: vendor.state,
                    zip: vendor.zip,
                    businessAddress: vendor.businessAddress,
                    businessDescription: vendor.businessDescription,
                    gstin: vendor.gstin,
                    displayImages: vendor.displayImages,
                    websiteUrl: vendor.websiteUrl,
                    socialMediaLinks: vendor.socialMediaLinks,
                    servicesOffered: vendor.servicesOffered,
                    isActive: vendor.isActive,
                    status: vendor.status,
                    registrationStatus: vendor.registrationStatus,
                    isMobileVerify: vendor.isMobileVerify,
                    isEmailVerify: vendor.isEmailVerify,
                    // createdAt: vendor.createdAt,
                    // updatedAt: vendor.updatedAt
                },
                // Pending changes (if any)
                pendingChanges: vendor.pendingChanges,
                profileUpdateStatus: vendor.profileUpdateStatus,
                profileUpdateReason: vendor.profileUpdateReason,
                lastUpdated: vendor.pendingChanges?.updatedAt
            }
        };
    }

    // Public endpoint for customers to view vendor profiles
    @Get(':vendorId/public')
    @UseGuards(OptionalAuthGuard) // instead of JwtAuthGuard
    async getVendorPublicProfile(
        @Param('vendorId') vendorId: string,
        @Req() req,
    ) {
        const profile = await this.vendorService.getVendorProfileForUser(
            req.user ? req.user.vendorId : null, // userId if logged in, null otherwise
            vendorId,
        );


        return {
            message: 'Vendor profile retrieved successfully',
            data: profile,
        };
    }



    // Public endpoint for customers to view vendor services offered
    @Get(':vendorId/services-offered')
    @UseGuards(OptionalAuthGuard) // instead of JwtAuthGuard
    async getServicesOfferedFromVendor(
        @Param('vendorId') vendorId: string,
        @Req() req,
    ) {
        const profile = await this.vendorService.getServiceField(vendorId,);


        return {
            message: 'Vendor profile retrieved successfully',
            data: profile,
        };
    }

    @Get(':vendorId/admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async getVendorProfileByAdmin(
        @Param('vendorId') vendorId: string,
        @Req() req
    ) {
        const profile = await this.vendorService.getVendorProfileForAdmin(req.user.vendorId, vendorId);
        return {
            message: 'Vendor profile retrieved successfully',
            data: profile
        };
    }
}
