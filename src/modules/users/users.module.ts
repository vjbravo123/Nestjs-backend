// // src/users/users.module.ts
// import { Module } from '@nestjs/common';
// import { MongooseModule } from '@nestjs/mongoose'; // ✅
// import { UsersController } from './users.controller';
// import { UsersService } from './users.service';
// import { User, UserSchema } from './users.schema'; // ✅

// @Module({
//   imports: [
//     MongooseModule.forFeature([
//       { name: User.name, schema: UserSchema }, // ✅ Binds User model
//     ]),
//   ],
//   controllers: [UsersController],
//   providers: [UsersService],
//   exports: [UsersService], // ✅ Export service to use in AuthModule
// })
// export class UsersModule {}
// users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MongooseModule } from '@nestjs/mongoose'; // ✅
import { User, UserSchema } from './users.schema'; // ✅
import { Vendor, VendorSchema } from '../vendor/vendor.schema'; // ✅
import { UtilityModule } from '../../services/utility.module'; // <- import module

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), // ✅ FIXED
    MongooseModule.forFeature([{ name: Vendor.name, schema: VendorSchema }]), // ✅ FIXED
    UtilityModule, // <- add here
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // ✅ So AuthModule can use UsersService
})
export class UsersModule { }
