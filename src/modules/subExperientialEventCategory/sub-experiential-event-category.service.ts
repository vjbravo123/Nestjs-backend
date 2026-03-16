import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
    SubExperientialEventCategory,
    SubExperientialEventCategoryDocument,
} from './sub-experiential-event-category.schema';
import { CreateSubExperientialEventCategoryDto } from './dto/create-sub-experiential-event-category.dto';
import { UpdateSubExperientialEventCategoryDto } from './dto/update-sub-experiential-event-category.dto';

@Injectable()
export class SubExperientialEventCategoryService {
    constructor(
        @InjectModel(SubExperientialEventCategory.name)
        private readonly model: Model<SubExperientialEventCategoryDocument>,
    ) { }

    async create(dto: CreateSubExperientialEventCategoryDto) {
        const created = new this.model({
            experientialEventCategoryId: new Types.ObjectId(
                dto.experientialEventCategoryId,
            ),
            name: dto.name,
            description: dto.description,
        });

        const saved = await created.save();

        return saved.populate({
            path: 'experientialEventCategoryId',
            select: 'name value type',
        });
    }

    async findAll(filter: any = {}) {
        // ✅ Always hide deleted
        filter.isDeleted = false;

        if (filter.experientialEventCategoryId) {
            filter.experientialEventCategoryId = new Types.ObjectId(
                filter.experientialEventCategoryId,
            );
        }

        if (filter.isActive !== undefined) {
            filter.isActive = filter.isActive === 'true';
        }

        console.log(
            'filter in find all sub experiential event category',
            filter,
        );

        return this.model.find(filter).populate({
            path: 'experientialEventCategoryId',
            select: 'name value type label',
        });
    }

    async findById(id: string) {
        const category = await this.model
            .findOne({
                _id: id,
                isDeleted: false,
            })
            .populate({
                path: 'experientialEventCategoryId',
                select: 'name value type label',
            });

        if (!category) {
            throw new NotFoundException(
                'Sub experiential event category not found',
            );
        }

        return category;
    }

    async update(
        id: string,
        dto: UpdateSubExperientialEventCategoryDto,
    ): Promise<SubExperientialEventCategoryDocument> {
        const category = await this.model.findOne({
            _id: id,
            isDeleted: false,
        });

        if (!category) {
            throw new NotFoundException(
                'Sub experiential event category not found or already deleted',
            );
        }

        if (dto.name !== undefined) {
            category.name = dto.name;
        }

        if (dto.description !== undefined) {
            category.description = dto.description;
        }

        if (dto.experientialEventCategoryId) {
            category.experientialEventCategoryId = new Types.ObjectId(
                dto.experientialEventCategoryId,
            );
        }

        if (dto.isActive !== undefined) {
            category.isActive = dto.isActive;
        }

        const updated = await category.save();

        return updated.populate({
            path: 'experientialEventCategoryId',
            select: 'name value type label',
        });
    }

    // ✅ SOFT DELETE (ADMIN)
    async deleteByAdmin(
        id: string,
    ): Promise<SubExperientialEventCategoryDocument> {
        const category = await this.model.findOne({
            _id: id,
            isDeleted: false,
        });

        if (!category) {
            throw new NotFoundException(
                'Sub experiential event category not found or already deleted',
            );
        }

        category.isDeleted = true;
        category.isActive = false;

        return category.save();
    }

    // ❌ HARD DELETE REMOVED (DON'T USE)
}
