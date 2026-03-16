import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomizePackageController } from './create-customize-package.controller';
import { CustomizePackageService } from './create-customize-package.service';
import { CustomizePackage, CustomizePackageSchema } from './customize-package.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CustomizePackage.name, schema: CustomizePackageSchema }]),
  ],
  controllers: [CustomizePackageController],
  providers: [CustomizePackageService],
})
export class CustomizePackageModule {}