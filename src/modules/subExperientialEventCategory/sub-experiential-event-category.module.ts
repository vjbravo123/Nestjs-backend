import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubExperientialEventCategory, SubExperientialEventCategorySchema } from './sub-experiential-event-category.schema';
import { SubExperientialEventCategoryService } from './sub-experiential-event-category.service';
import { SubExperientialEventCategoryController } from './sub-experiential-event-category.controller';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: SubExperientialEventCategory.name, schema: SubExperientialEventCategorySchema },
        ]),
    ],
    providers: [SubExperientialEventCategoryService],
    controllers: [SubExperientialEventCategoryController],
    exports: [SubExperientialEventCategoryService],
})
export class SubExperientialEventCategoryModule { }