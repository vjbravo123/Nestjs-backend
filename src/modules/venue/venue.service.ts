import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Venue, VenueDocument } from './venue.schema';
import { CreateVenueDto } from './create-venue.dto';
import {
  uploadVenueImages,
  safeParse,
  parseExistingImages,
} from '../../common/utils/venue-image.util';

@Injectable()
export class VenueService {
  constructor(
    @InjectModel(Venue.name) private venueModel: Model<VenueDocument>,
  ) {}

  async create(createVenueDto: CreateVenueDto,files: Array<Express.Multer.File>,): Promise<Venue> {
  const imageUrls = await uploadVenueImages(files,createVenueDto.name.replace(/\s+/g, '-'),);
  const createdVenue = new this.venueModel({...createVenueDto,images: imageUrls, });
  return createdVenue.save();
}

  // async findAll(): Promise<Venue[]> {
  //   return this.venueModel.find().exec();
  // }
 async findAll(query: any = {}): Promise<any> {
  const {
    page = 1,
    limit = 10,
    search,
    type,
    city,
    minGuests,
    maxBudget,
    sortBy,
  } = query;

  const match: any = { isDeleted: false };

  if (type && type !== 'all') match.type = type;
  if (city && city !== 'all') match.city = new RegExp(city, 'i');
  
  // Search logic
  if (search) {
    const regex = new RegExp(search, 'i');
    match.$or = [
      { name: regex },
      { city: regex },
      { address: regex },
    ];
  }

  // Filter by Capacity
  if (minGuests) {
    match.capacityMax = { $gte: Number(minGuests) };
  }

  // Filter by Budget (Checking any tier price <= maxBudget)
  if (maxBudget) {
    match['pricingTiers.pricePerPlate'] = { $lte: Number(maxBudget) };
  }

  const skip = (Number(page) - 1) * Number(limit);

  // Sorting logic
  let sortOptions: any = { createdAt: -1 };
  if (sortBy === 'price_low') sortOptions = { 'pricingTiers.0.pricePerPlate': 1 };
  if (sortBy === 'price_high') sortOptions = { 'pricingTiers.0.pricePerPlate': -1 };
  if (sortBy === 'rating') sortOptions = { rating: -1 };

  const [data, total] = await Promise.all([
    this.venueModel.find(match).sort(sortOptions).skip(skip).limit(Number(limit)).exec(),
    this.venueModel.countDocuments(match),
  ]);

  return {
    data,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
    totalResults: total,
  };
}

  async findOne(id: string): Promise<Venue> {
    const venue = await this.venueModel.findById(id).exec();
    if (!venue) throw new NotFoundException('Venue not found');
    return venue;
  }

  async update(id: string,updateVenueDto: any,files: Array<Express.Multer.File>, ): Promise<Venue> {
    // Upload any newly provided images
    const newImageUrls = await uploadVenueImages(files, `update-${id}`);

    // Merge images the client wants to keep with the freshly uploaded ones
    const existingImages = parseExistingImages(updateVenueDto.existingImages);

    // Build the clean payload — parse nested fields that arrive as JSON strings
    const formattedData = {
      ...updateVenueDto,
      images: [...existingImages, ...newImageUrls],
      pricingTiers: safeParse(updateVenueDto.pricingTiers),
      areas: safeParse(updateVenueDto.areas),
      policies: safeParse(updateVenueDto.policies),
      amenities: safeParse(updateVenueDto.amenities),
    };

    // Remove the helper field before persisting
    delete formattedData.existingImages;

    const updatedVenue = await this.venueModel.findByIdAndUpdate(id,{ $set: formattedData },{ new: true, runValidators: true },).exec();

    if (!updatedVenue) throw new NotFoundException('Venue not found');
    return updatedVenue;
  }

  async toggleActive(id: string): Promise<Venue> {
  const venue = await this.venueModel.findById(id).exec();
  if (!venue) throw new NotFoundException('Venue not found');

  venue.isActive = !venue.isActive;
  return venue.save();
}

  async remove(id: string): Promise<any> {
    const result = await this.venueModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Venue not found');
    return result;
  }
}