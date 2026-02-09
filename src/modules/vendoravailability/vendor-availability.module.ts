import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorAvailabilityService } from './vendor-availability.service';
import { VendorAvailabilityController } from './vendor-availability.controller';
import { VendorAvailability, VendorAvailabilitySchema } from './vendor-availability.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VendorAvailability.name, schema: VendorAvailabilitySchema },
    ]),
  ],
  providers: [VendorAvailabilityService],
  controllers: [VendorAvailabilityController],

  // ✅ IMPORTANT: export service so other modules can use it
  exports: [VendorAvailabilityService],
})
export class VendorAvailabilityModule { }
