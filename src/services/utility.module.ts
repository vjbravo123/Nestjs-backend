// src/services/utility.module.ts
import { Module } from '@nestjs/common';
import { UtilityService } from './utility.service';

@Module({
    providers: [UtilityService],
    exports: [UtilityService], // export for other modules
})
export class UtilityModule { }
