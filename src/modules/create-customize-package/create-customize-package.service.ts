import {
  Injectable,
  InternalServerErrorException,
  Logger,

} from '@nestjs/common';

import { FilterQuery, SortOrder } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdminQueryCustomizePackageDto } from './dto/admin-query-customize-package.dto'
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CustomizePackage } from './customize-package.schema';
import { CreateCustomizePackageDto } from './dto/create-customize-package.dto';

@Injectable()
export class CustomizePackageService {
  private readonly logger = new Logger(CustomizePackageService.name);

  constructor(
    @InjectModel(CustomizePackage.name)
    private readonly customizePackageModel: Model<CustomizePackage>,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  // ----------------------------
  // CREATE
  // ----------------------------
  async create(
    dto: CreateCustomizePackageDto,
  ): Promise<CustomizePackage> {
    try {
      const payload = {
        eventCategory: dto.eventCategory,
        eventId: dto.eventId,
        name: dto.name.trim(),
        phone: dto.phone,
        email: dto.email.toLowerCase(),
        venueSizeCount: dto.venueSizeCount,
        preferredDate: dto.preferredDate,
        budgetRange: dto.budgetRange,
        modifications: dto.modifications ?? [],
        status: 'PENDING',
      };

      const created = await this.customizePackageModel.create(payload);

      this.eventEmitter.emit('customizepackage.created', {
        requestId: (created as any)._id?.toString(),
        name: created.name,
        phone: created.phone,
        email: created.email,
        preferredDate: created.preferredDate,
        budgetRange: created.budgetRange,
        createdAt: (created as any).createdAt?.toISOString(),
      });

      return created;
    } catch (error) {
      console.log("error", error)
      this.logger.error(
        'Failed to create customize package request',
        error.stack,
      );
      throw new InternalServerErrorException(
        'Unable to submit customize package request',
      );
    }
  }

  // ----------------------------
  // GET ALL
  // ----------------------------
  // ------------------------------------------------
  // ADMIN LIST (USING PAGINATE PLUGIN)
  // ------------------------------------------------
  async getForAdmin(
    query: AdminQueryCustomizePackageDto,
  ) {
    const {
      search,
      status,
      page = 1,
      limit = 20,
    } = query;

    const filter: FilterQuery<CustomizePackage> = {};

    // 🔍 Search
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // 📌 Status filter
    if (status) {
      filter.status = status;
    }

    // 🧭 Pagination options (PLUGIN STYLE)
    const options = {
      page: Number(page),
      limit: Number(limit),
      sortBy: 'createdAt:desc',
      select:
        'name phone email venueSizeCount preferredDate budgetRange modifications status createdAt',
      lean: true,
    };

    // ⚡ Use paginate plugin
    const result =
      await (this.customizePackageModel as any).paginate(
        filter,
        options,
      );

    // 🛡 Safety (same as your AddOn code)
    if (!result || !Array.isArray(result.results)) {
      return {
        success: true,
        results: [],
        page: Number(page),
        limit: Number(limit),
        totalResults: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      };
    }

    return {
      success: true,
      ...result,
    };
  }
}
