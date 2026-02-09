import { Vendor, VendorSchema } from './vendor.schema';
import { Order, OrderSchema } from '../order/order.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorService } from './vendor.service';
import { VendorController } from './vendor.controller';
import { UtilityModule } from '../../services/utility.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Vendor.name, schema: VendorSchema },
            { name: Order.name, schema: OrderSchema },
        ]),
        UtilityModule,
    ],
    controllers: [VendorController],
    providers: [VendorService],
    exports: [
        VendorService,
        MongooseModule, // ✅ export MongooseModule so other modules (AuthModule, etc.) can inject VendorModel
    ],
})
export class VendorModule { }
