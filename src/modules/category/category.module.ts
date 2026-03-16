import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from './category.schema';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { BirthdayEventModule } from '../birthdayevent/birthdayevent.module'
import { ExperientialEventModule } from '../experientialevent/experientialevent.module'

@Module({
    imports: [MongooseModule.forFeature([{ name: Category.name, schema: CategorySchema }]),
        ExperientialEventModule,
        BirthdayEventModule

    ],
    providers: [CategoryService],
    controllers: [CategoryController],
})
export class CategoryModule { }