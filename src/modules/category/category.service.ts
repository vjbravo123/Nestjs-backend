import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category } from './category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoryByEventDto } from './dto/get-category-by-eventid.dto'
import { ExperientialEventService } from '../experientialevent/experientialevent.service'
import { BirthdayEventService } from '../birthdayevent/birthdayevent.service';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<Category>,

    private readonly birthdayEventService: BirthdayEventService,
    private readonly experientialEventService: ExperientialEventService

  ) { }

  async create(dto: CreateCategoryDto) {
    const exists = await this.categoryModel.findOne({ name: dto.name.toLowerCase() });
    if (exists) throw new BadRequestException('Category already exists');
    const category = new this.categoryModel(dto);
    return category.save();
  }

  async findAll(options: any = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      populate,
      isActive,
      ...filter
    } = options;

    // 🟢 Handle boolean filter for isActive
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    // 🟢 Any other custom filters can be added here
    // For example, filtering by name (partial match)
    if (filter.name) {
      filter.name = { $regex: filter.name, $options: 'i' }; // case-insensitive
    }

    // 🟢 Build final filter
    const finalFilter = { ...filter };

    // 🟢 Use paginate (TypeScript will need `as any` or a proper model type)
    return (this.categoryModel as any).paginate(finalFilter, {
      page: Number(page),
      limit: Number(limit),
      sort: sortBy,
      populate,
    });
  }


  async getCategory(query: any = {}) {
    console.log("query category", query);
    if (query.categoryId) {
      query._id = { $in: query.categoryId.split(',').map((id: string) => id.trim()) }
      delete query.categoryId;
    }
    return this.categoryModel.find(query).exec();
  }

  async update(id: string, dto: Partial<CreateCategoryDto> = {}) {
    console.log("dto category", dto);
    const category = await this.categoryModel.findById(id);
    if (!category) throw new NotFoundException('Category not found');

    if (dto.name) category.name = dto.name.toLowerCase();
    if (dto.icon) category.icon = dto.icon;

    return category.save();
  }

  async setActiveStatus(id: string, isActive: boolean) {
    const category = await this.categoryModel.findById(id);
    if (!category) throw new NotFoundException('Category not found');

    category.isActive = isActive; // explicitly set
    return category.save();
  }

  async getCategoryByEventId(dto: CategoryByEventDto) {
    const { eventId, eventType } = dto;
    console.log("dto category by event", dto);
    // 1️⃣ Resolve event by type (future-safe)
    const event = await this.getEventByType(eventType, eventId.toString());

    if (!event) {
      throw new BadRequestException('Event does not exist');
    }

    // 2️⃣ Validate addOns exists and is an array
    if (!Array.isArray(event.addOns) || event.addOns.length === 0) {
      return []; // event has no addons → return empty list
    }

    // 3️⃣ Fetch categories in a single query
    const categories = await this.categoryModel
      .find({ _id: { $in: event.addOns }, isActive: true })
      .select('name icon')
      .lean();

    return categories;
  }


  // -----------------------------
  //  🔥 Helper: Event Resolver
  // -----------------------------
  private async getEventByType(type: string, eventId: string) {
    const map: Record<string, () => Promise<any>> = {
      BirthdayEvent: () => this.birthdayEventService.findById(eventId),
      ExperientialEvent: () => this.experientialEventService.getById(eventId),
      // serviceEvent: () => this.serviceEventService.getById(eventId),
    };

    const resolver = map[type];

    if (!resolver) {
      throw new BadRequestException(`Invalid event type: ${type}`);
    }

    return await resolver();  // 🔥 only calls one service
  }

}
