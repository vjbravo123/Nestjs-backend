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
  } = query;

  const match: any = { isDeleted: false };

  if (type) match.type = type;

  if (search) {
    const regex = new RegExp(search, 'i');
    match.$or = [
      { name: regex },
      { city: regex },
      { address: regex },
      { type: regex },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [data, total] = await Promise.all([
    this.venueModel.find(match).skip(skip).limit(Number(limit)).exec(),
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