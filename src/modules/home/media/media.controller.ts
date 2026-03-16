import {
    Controller,
    Post,
    Body,
    UseGuards,
    UploadedFiles,
    UseInterceptors,
    BadRequestException,
    Get,
    Query,
    ForbiddenException,
    Param,
    Delete,
    Patch,
} from '@nestjs/common';

import { MediaService } from './media.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Types } from 'mongoose';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { uploadImageToS3 } from '../../../common/utils/s3-upload.util';
import { deleteImageFromS3 } from '../../../common/utils/s3-upload.util';
import { extractS3KeyFromUrl } from "../../../common/utils/s3-upload.util";
import { MongoIdPipe } from '../../../common/pipes/parse-objectid.pipe';

import { AdminQueryMediaDto } from './dto/admin-query-media.dto'; // 🔹 we'll generate this if required
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../modules/auth/types/auth-user.type';




@Controller('home/media')
export class MediaController {
    constructor(private readonly mediaService: MediaService) { }

    // ────────────────────────────────────────────────────────────────
    // 🧩 ADMIN: Create Media (Image/Video + Icon)
    // ────────────────────────────────────────────────────────────────
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'icon', maxCount: 1 },
            { name: 'file', maxCount: 1 },
        ]),
    )
    async create(
        @Body() dto: CreateMediaDto,
        @UploadedFiles()
        files: { icon?: Express.Multer.File[]; file?: Express.Multer.File[] },
        @CurrentUser() admin: AuthUser,
    ) {
        if (!files?.icon?.length) {
            throw new BadRequestException('Icon image is required.');
        }
        if (!files?.file?.length) {
            throw new BadRequestException('Media file (image/video) is required.');
        }

        // Upload Icon
        const iconFile = files.icon[0];
        const iconUrl = await uploadImageToS3({
            fileBuffer: iconFile.buffer,
            key: `media/icons/${dto.title}-${Date.now()}-${iconFile.originalname}`,
            contentType: iconFile.mimetype,
        });

        // Upload Media File
        const media = files.file[0];
        const mediaUrl = await uploadImageToS3({
            fileBuffer: media.buffer,
            key: `media/files/${dto.title}-${Date.now()}-${media.originalname}`,
            contentType: media.mimetype,
        });

        const payload = {
            ...dto,
            icon: iconUrl,
            file: mediaUrl,
        };

        const result = await this.mediaService.create(payload);
        return {
            message: 'Media created successfully.',
            data: result,
        };
    }

    // ────────────────────────────────────────────────────────────────
    // 🧩 ADMIN: Get All Media
    // ────────────────────────────────────────────────────────────────
    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async getAll(@Query() query: AdminQueryMediaDto) {
        const items = await this.mediaService.getAllForAdmin(query);

        return {
            message: 'Media list fetched successfully.',
            data: items,
        };
    }
    // ────────────────────────────────────────────────────────────────
    // 🌍 PUBLIC: Get Media For Home Page
    // ────────────────────────────────────────────────────────────────
    @Get('public')
    async getForHomePage() {
        const items = await this.mediaService.getForHomePage();
        return {
            message: 'Media items fetched successfully for home page.',
            data: items,
        };
    }


    // ────────────────────────────────────────────────────────────────
    // 🧩 ADMIN: Delete Media
    // ────────────────────────────────────────────────────────────────
    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async remove(@Param('id') id: string) {
        const media = await this.mediaService.getOne(id);
        if (!media) throw new BadRequestException('Media not found.');

        // remove icon + media from S3
        const iconKey = extractS3KeyFromUrl(media.icon);
        const fileKey = extractS3KeyFromUrl(media.file);

        if (iconKey) await deleteImageFromS3({ key: iconKey });
        if (fileKey) await deleteImageFromS3({ key: fileKey });



        await this.mediaService.delete(id);

        return {
            message: 'Media deleted successfully.',
        };
    }

    // ────────────────────────────────────────────────────────────────
    // 🧩 ADMIN: Update Media (Meta Only)
    // ────────────────────────────────────────────────────────────────


    @Patch(':mediaId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'icon', maxCount: 1 },
            { name: 'file', maxCount: 1 },
        ]),
    )
    async updateMedia(
        @Param('mediaId', MongoIdPipe) mediaId: Types.ObjectId,
        @Body() dto: UpdateMediaDto,
        @UploadedFiles()
        files: { icon?: Express.Multer.File[]; file?: Express.Multer.File[] },
    ) {
        const updated = await this.mediaService.updateWithFiles(
            mediaId.toString(),
            dto,
            files,
        );

        return {
            message: 'Media updated successfully.',
            data: updated,
        };
    }




    // ────────────────────────────────────────────────────────────────
    // 🧩 ADMIN: Get Media by ID
    // ────────────────────────────────────────────────────────────────
    @Get(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async getMediaById(@Param('id') id: string) {
        const media = await this.mediaService.getOne(id);

        return {
            message: 'Media fetched successfully.',
            data: media,
        };
    }





}
