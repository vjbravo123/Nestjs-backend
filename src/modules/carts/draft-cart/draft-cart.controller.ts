import {
    Body,
    Controller,
    Post,
    Patch,
    Get,
    Req,
    HttpCode,
    HttpStatus,
    UseGuards,
    ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { DraftCartService } from './draft-cart.service';
import { AddToDraftDto } from './dto/add-to-draft.dto';
import { UpdateDraftScheduleDto } from './dto/update-draft-schedule.dto';
import { UpdateDraftAddonsDto } from './dto/update-draft-addon.dto';
import { UpdateDraftAddressDto } from './dto/update-draft-address.dto';
import { UpdateDraftUpgradeEventTierDto } from './dto/upgrade-draft-event-tier.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../auth/types/auth-user.type';

@ApiTags('Draft Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('draft-cart') // 🔥 Modern route naming
export class DraftCartController {
    constructor(private readonly draftCartService: DraftCartService) { }

    // ─────────── Add or Update Draft Event ───────────
    @Post('add')
    @Roles('user')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Add or update an event in the draft cart' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Event successfully added/updated in draft cart' })
    async addToDraft(
        @CurrentUser() user: AuthUser,
        @Body() dto: AddToDraftDto,
    ) {
        if (!user?.userId) throw new ForbiddenException('Unauthorized: Missing user ID.');
        const result = await this.draftCartService.addOrUpdateDraft(user.userId, dto);
        return {
            message: 'Event successfully added to draft cart.',
            data: result,
        };
    }

    // ─────────── Get User Draft Cart ───────────
    @Get()
    @Roles('user')
    async getDraftCart(@CurrentUser() user: AuthUser) {
        if (!user?.userId) throw new ForbiddenException('Unauthorized: Missing user ID.');
        return this.draftCartService.getDraftCartByUser(user.userId);
    }

    // // ─────────── Update Event Schedule ───────────
    @Patch('schedule')
    @Roles('user')
    async updateDraftSchedule(
        @CurrentUser() user: AuthUser,
        @Body() dto: UpdateDraftScheduleDto,
    ) {
        if (!user?.userId) throw new ForbiddenException('Unauthorized: Missing user ID.');
        const updated = await this.draftCartService.updateDraftSchedule(user.userId, dto);
        return {
            message: 'Draft cart schedule updated successfully.',
            data: updated,
        };
    }

    // // ─────────── Update Addons ───────────
    @Patch('update-addon')
    @Roles('user')
    async updateDraftAddons(
        @CurrentUser() user: AuthUser,
        @Body() dto: UpdateDraftAddonsDto,
    ) {
        if (!user?.userId) throw new ForbiddenException('Unauthorized: Missing user ID.');
        const updated = await this.draftCartService.updateDraftAddons(user.userId, dto);
        return {
            message: 'Draft cart addons updated successfully.',
            data: updated,
        };
    }
    @Patch('update-address')
    @Roles('user')
    async updateDraftAddress(
        @CurrentUser() user: AuthUser,
        @Body() dto: UpdateDraftAddressDto,
    ) {
        if (!user?.userId) throw new ForbiddenException('Unauthorized: Missing user ID.');
        const updated = await this.draftCartService.updateDraftAddress(user.userId, dto);
        return {
            message: 'Draft cart addons updated successfully.',
            data: updated,
        };
    }
    // @Patch('update-planner')
    // @Roles('user')
    // async updateDraftPlanner(
    //     @CurrentUser() user: AuthUser,
    //     @Body() dto: UpdateDraftAddressDto,
    // ) {
    //     if (!user?.userId) throw new ForbiddenException('Unauthorized: Missing user ID.');
    //     const updated = await this.draftCartService.updateDraftAddress(user.userId, dto);
    //     return {
    //         message: 'Draft cart addons updated successfully.',
    //         data: updated,
    //     };
    // }
    @Patch('upgrade-event-tier')
    @Roles('user')
    async upgradeDraftEventTier(
        @CurrentUser() user: AuthUser,
        @Body() dto: UpdateDraftUpgradeEventTierDto,
    ) {
        if (!user?.userId) throw new ForbiddenException('Unauthorized: Missing user ID.');
        const updated = await this.draftCartService.upgradeDraftEventTier(user.userId, dto);
        return {
            message: 'Draft cart addons updated successfully.',
            data: updated,
        };
    }


    @Get('upgrade-suggestions')
    async getUpgradeSuggestions(
        @CurrentUser() user: AuthUser,
        @Req() req) {
        return this.draftCartService.getUpgradeSuggestions(req.user.userId);
    }


    @Get('planner-price')
    @Roles('user')
    async getPlannerPrice(
        @CurrentUser() user: AuthUser,
        @Req() req,
    ) {
        if (!user.userId) {
            throw new ForbiddenException('User ID not found');
        }
        return this.draftCartService.getPlannerPrice(user.userId);
    }
}
