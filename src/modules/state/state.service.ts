import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { State, StateDocument } from './state.schema';
import { CreateStateDto } from './dto/create-state.dto';
import { PublicStateQueryDto } from './dto/public-state-query.dto';

@Injectable()
export class StateService {
  constructor(
    @InjectModel(State.name) private stateModel: Model<StateDocument>,
  ) {}

  async create(createStateDto: CreateStateDto): Promise<State> {
    const created = new this.stateModel(createStateDto);
    return created.save();
  }

  async getPublicStates(query: PublicStateQueryDto) {
    const {
      search,
      country,
      isDeleted,
      active,
      page,
      limit,
      sortBy,
      cursor,
    } = query;

    /** ------------------------
     * FILTERS
     * ------------------------ */
    const filter: any = {};

    if (active !== undefined) {
      filter.active = active;
    }
    if (isDeleted !== undefined) {
      filter.isDeleted = isDeleted;
    }

    if (country) filter.country = country;

    if (search) {
      filter.$or = [
        { state: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } },
      ];
    }

    /** ------------------------
     * PAGINATION OPTIONS
     * ------------------------ */
    const options = {
      page,
      limit,
      cursor,
      sortBy: sortBy || 'state:asc',
      select: '_id state country formattedAddress lat lng place_id cities active createdAt',
      populate: { path: 'cities', select: '_id city district pincode lat lng place_id active' },
    };

    /** ------------------------
     * PAGINATED RESULT
     * ------------------------ */
    return await (this.stateModel as any).paginate(filter, options);
  }

  async findOne(id: string): Promise<StateDocument> {
    const state = await this.stateModel
      .findById(id)
      .populate('cities', '_id city district pincode lat lng place_id active')
      .exec();
    if (!state) throw new NotFoundException('State not found');
    return state;
  }

  async toggleActive(id: string): Promise<StateDocument> {
    const state = await this.stateModel.findById(id);
    if (!state) throw new NotFoundException('State not found');
    state.active = !state.active;
    return state.save();
  }

  async deleteStateByAdmin(stateId: string): Promise<StateDocument> {
    const state = await this.stateModel.findOne({
      _id: stateId,
      isDeleted: false,
    });

    if (!state) {
      throw new NotFoundException('State not found or already deleted');
    }

    state.isDeleted = true;
    state.active = false;

    return state.save();
  }
}
