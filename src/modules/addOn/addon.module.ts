import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AddOn, AddOnSchema } from './addon.schema';
import { Category, CategorySchema } from '../category/category.schema'; // 👈 import Category schema
import { AddOnService } from './addon.service';
import { AddOnController } from './addon.controller';
import { OrderModule } from '../order/order.module';
import { VendorAvailabilityModule } from '../vendoravailability/vendor-availability.module';
import { AddOnHistoryModule } from '../addon-history/addon-history.module';
import { Commission, CommissionSchema } from '../commission/commission.schema';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AddOn.name, schema: AddOnSchema },
      { name: Category.name, schema: CategorySchema }, // 👈 register Category model
       { name: Commission.name, schema: CommissionSchema },
    ]),
    VendorAvailabilityModule,
    AddOnHistoryModule,
    forwardRef(() => OrderModule),
  ],
  providers: [AddOnService],
  controllers: [AddOnController],
  exports: [AddOnService,], // 👈 export if other modules need it
})
export class AddOnModule { }
