import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  Query,
} from '@nestjs/common';
import { VenueService } from './venue.service';
import { CreateVenueDto } from './create-venue.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  // Create a new venue — uploads images to S3 (with fallback), then saves to DB
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FilesInterceptor('images'))
  async create(
    @Body() createVenueDto: CreateVenueDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.venueService.create(createVenueDto, files);
  }

  // Return all venues
  // @Get()
  // findAll() {
  //   return this.venueService.findAll();
  // }
  @Get()
findAll(@Query() query: any) {
  return this.venueService.findAll(query);
}

  // Return a single venue by ID
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.venueService.findOne(id);
  }

  // Update a venue — merges existing + new images, parses nested form-data fields
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'vendor')
  @UseInterceptors(FilesInterceptor('images'))
  async update(
    @Param('id') id: string,
    @Body() updateVenueDto: any,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.venueService.update(id, updateVenueDto, files);
  }

  // Toggle active status for a venue
@Patch(':id/active')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'vendor')
toggleActive(@Param('id') id: string) {
  return this.venueService.toggleActive(id);
}

  // Delete a venue by ID (admin only)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.venueService.remove(id);
  }
}