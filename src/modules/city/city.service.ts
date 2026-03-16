import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { City, CityDocument } from './city.schema';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { PublicCityQueryDto } from './dto/public-city-query.dto';
import { isDecimal } from 'class-validator';
@Injectable()
export class CityService {
  constructor(
    @InjectModel(City.name) private cityModel: Model<CityDocument>,
  ) { }

  async create(createCityDto: CreateCityDto): Promise<City> {
    const createdCity = new this.cityModel(createCityDto);
    return createdCity.save();
  }

  async findAll(): Promise<City[]> {
    return this.cityModel.find().exec();
  }


  async getPublicCities(query: PublicCityQueryDto) {
    console.log('PublicCityQueryDto:', query);

    const {
      search,
      country,
      state,
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

    // ✅ Apply active filter ONLY if provided
    if (active !== undefined) {
      filter.active = active;
    }
    if (isDeleted !== undefined) {
      filter.isDeleted = isDeleted;
    }

    if (country) filter.country = country;
    if (state) filter.state = state;

    if (search) {
      filter.$or = [
        { city: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } },
      ];
    }

    /** ------------------------
     * PAGINATION OPTIONS
     * ------------------------ */
    const options = {
      page,
      limit,
      cursor,
      sortBy: sortBy || 'city:asc',
      select: '_id city state country district pincode neighborhood sublocality lat lng place_id active  createdAt ',

    };

    /** ------------------------
     * PAGINATED RESULT
     * ------------------------ */
    return await (this.cityModel as any).paginate(filter, options);
  }


  async findOne(id: string): Promise<City> {
    const city = await this.cityModel.findById(id).exec();
    if (!city) throw new NotFoundException('City not found');
    return city;
  }

  async update(id: string): Promise<City> {
    const city = await this.cityModel.findById(id);
    if (!city) throw new NotFoundException('City not found');
    city.active = !city.active;
    await city.save();

    return city;
  }

  async deleteCityByAdmin(cityId: string,): Promise<CityDocument> {
    const city = await this.cityModel.findOne({
      _id: cityId,
      isDeleted: false,
    });

    if (!city) {
      throw new NotFoundException('City not found or already deleted');
    }

    // ✅ Soft delete using isDeleted
    city.isDeleted = true;
    city.active = false;

    // 🔒 Optional audit fields (if present)
    // city.deletedBy = adminId;
    // city.deletedAt = new Date();

    return await city.save();
  }

}