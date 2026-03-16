import {
    Injectable,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { instanceToPlain } from 'class-transformer';
import { Model, Types, PipelineStage } from 'mongoose';
import { Media } from './schemas/media.schema';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { AdminQueryMediaDto } from './dto/admin-query-media.dto';
import { extractS3KeyFromUrl, uploadImageToS3, deleteImageFromS3 } from '../../../common/utils/s3-upload.util';
import logger from '../../../common/utils/logger';
import { validateMediaFile, validateIconFile } from '../../../common/utils/validate-file-type.util';

@Injectable()
export class MediaService {
    constructor(
        @InjectModel(Media.name)
        private readonly mediaModel: Model<Media>,
    ) { }

    // --------------------------------------------------
    // 🧩 CREATE MEDIA
    // --------------------------------------------------
    async create(payload: Partial<CreateMediaDto> & { icon: string; file: string }) {
        if (!payload.icon || !payload.file) {
            throw new BadRequestException('Both icon and media file are required.');
        }

        const created = await this.mediaModel.create({
            mediaType: payload.mediaType,
            title: payload.title,
            description: payload.description,
            icon: payload.icon,
            file: payload.file,
        });

        return created
    }




    // --------------------------------------------------
    // 🧩 ADMIN LIST (FILTER + PAGINATION)
    // --------------------------------------------------
    async getAllForAdmin(query: AdminQueryMediaDto) {
        const { mediaType, search, page = 1, limit = 20 } = query;

        const pageNum = Math.max(Number(page), 1);
        const perPage = Math.max(Number(limit), 1);
        const skip = (pageNum - 1) * perPage;

        const filter: Record<string, any> = {};
        if (mediaType) filter.mediaType = mediaType;

        if (search) {
            filter.$or = [
                { title: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') },
            ];
        }

        const pipeline: PipelineStage[] = [
            { $match: filter },
            { $sort: { createdAt: -1 } },
            {
                $project: {
                    _id: 1,
                    mediaType: 1,
                    title: 1,
                    description: 1,
                    icon: 1,
                    file: 1,
                    createdAt: 1,
                    updatedAt: 1,
                },
            },
            { $skip: skip },
            { $limit: perPage },
        ];

        const [data, totalCount] = await Promise.all([
            this.mediaModel.aggregate(pipeline),
            this.mediaModel.countDocuments(filter),
        ]);

        return {
            success: true,
            message: 'Media fetched successfully',
            results: data,
            totalResults: totalCount,
            totalPages: Math.ceil(totalCount / perPage),
            currentPage: pageNum,
            limit: perPage,
        };
    }

    // --------------------------------------------------
    // 🌍 PUBLIC: HOME PAGE MEDIA
    // --------------------------------------------------
    async getForHomePage() {
        return this.mediaModel
            .find()
            .select('mediaType title description icon file')
            .sort({ createdAt: -1 })
            .lean();
    }

    // --------------------------------------------------
    // 🧾 GET ONE MEDIA
    // --------------------------------------------------
    async getOne(id: string) {
        if (!Types.ObjectId.isValid(id))
            throw new BadRequestException('Invalid media ID');

        const media = await this.mediaModel.findById(id);
        if (!media) throw new NotFoundException('Media not found');

        return media;
    }

    // --------------------------------------------------
    // 🛠 UPDATE MEDIA
    // --------------------------------------------------
    async updateWithFiles(
        id: string,
        dto: UpdateMediaDto,
        files: { icon?: Express.Multer.File[]; file?: Express.Multer.File[] },
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid media ID');
        }

        const existing = await this.mediaModel.findById(id);
        if (!existing) throw new NotFoundException('Media not found');

        const updatePayload: any = { ...dto };

        // ─────────────────────────────────────────
        // MAIN MEDIA FILE (image / video)
        // ─────────────────────────────────────────
        if (files?.file?.length) {
            const file = files.file[0];

            // ✅ VALIDATION (USING YOUR UTIL)
            validateMediaFile(existing.mediaType, file.mimetype);

            // delete old file
            const oldFileKey = extractS3KeyFromUrl(existing.file);
            if (oldFileKey) {
                await deleteImageFromS3({ key: oldFileKey });
            }

            // upload new file
            const fileUrl = await uploadImageToS3({
                fileBuffer: file.buffer,
                key: `media/files/${existing.title}-${Date.now()}-${file.originalname}`,
                contentType: file.mimetype,
            });

            updatePayload.file = fileUrl;
        }

        // ─────────────────────────────────────────
        // ICON FILE (ALWAYS IMAGE)
        // ─────────────────────────────────────────
        if (files?.icon?.length) {
            const icon = files.icon[0];

            // ✅ VALIDATION (USING YOUR UTIL)
            validateIconFile(icon.mimetype);

            const oldIconKey = extractS3KeyFromUrl(existing.icon);
            if (oldIconKey) {
                await deleteImageFromS3({ key: oldIconKey });
            }

            const iconUrl = await uploadImageToS3({
                fileBuffer: icon.buffer,
                key: `media/icons/${existing.title}-${Date.now()}-${icon.originalname}`,
                contentType: icon.mimetype,
            });

            updatePayload.icon = iconUrl;
        }

        return this.mediaModel.findByIdAndUpdate(id, updatePayload, { new: true });
    }


    // --------------------------------------------------
    // 🗑 DELETE MEDIA
    // --------------------------------------------------
    async delete(id: string) {
        if (!Types.ObjectId.isValid(id))
            throw new BadRequestException('Invalid media ID');

        const media = await this.mediaModel.findById(id);
        if (!media) throw new NotFoundException('Media not found');

        // ---------------------------
        // DELETE S3 ASSETS SAFELY
        // ---------------------------
        try {
            const iconKey = extractS3KeyFromUrl(media.icon);
            if (iconKey) await deleteImageFromS3({ key: iconKey });

            const fileKey = extractS3KeyFromUrl(media.file);
            if (fileKey) await deleteImageFromS3({ key: fileKey });
        } catch (err) {
            logger.error('Error deleting S3 assets on media delete', err);
        }

        await this.mediaModel.findByIdAndDelete(id);

        return { success: true, message: 'Media deleted successfully' };
    }
}
