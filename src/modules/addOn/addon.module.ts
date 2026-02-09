import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AddOn, AddOnSchema } from './addon.schema';
import { Category, CategorySchema } from '../category/category.schema'; // 👈 import Category schema
import { AddOnService } from './addon.service';
import { AddOnController } from './addon.controller';
import { VendorAvailabilityModule } from '../vendoravailability/vendor-availability.module';
import { AddOnHistoryModule } from '../addon-history/addon-history.module';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AddOn.name, schema: AddOnSchema },
      { name: Category.name, schema: CategorySchema }, // 👈 register Category model
    ]),
    VendorAvailabilityModule,
    AddOnHistoryModule
  ],
  providers: [AddOnService],
  controllers: [AddOnController],
  exports: [AddOnService,], // 👈 export if other modules need it
})
export class AddOnModule { }
