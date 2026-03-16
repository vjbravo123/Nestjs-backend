import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DropdownController } from './dropdown.controller';
import { DropdownService } from './dropdown.service';
import { DropdownOption, DropdownOptionSchema } from './dropdown.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: DropdownOption.name, schema: DropdownOptionSchema },
        ]),
    ],
    controllers: [DropdownController],
    providers: [DropdownService],
    exports: [DropdownService],
})
export class DropdownModule { }
