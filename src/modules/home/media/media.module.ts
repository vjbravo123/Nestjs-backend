import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Media, MediaSchema } from './schemas/media.schema';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }]),
    ],
    controllers: [MediaController],
    providers: [MediaService],
    exports: [MediaService],
})
export class MediaModule {}
