import { Vendor, VendorSchema } from './vendor.schema';
import { Order, OrderSchema } from '../order/order.schema';
import { Auth, AuthSchema } from '../auth/auth.schema';
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorService } from './vendor.service';
import { VendorController } from './vendor.controller';
import { UtilityModule } from '../../services/utility.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { VendorAvailabilityModule } from '../vendoravailability/vendor-availability.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Vendor.name, schema: VendorSchema },
            { name: Order.name, schema: OrderSchema },
            { name: Auth.name, schema: AuthSchema },
        ]),
        UtilityModule,
        UsersModule,
        forwardRef(() => AuthModule),
        VendorAvailabilityModule,
    ],
    controllers: [VendorController],
    providers: [VendorService],
    exports: [
        VendorService,
        MongooseModule,
    ],
})
export class VendorModule { }
