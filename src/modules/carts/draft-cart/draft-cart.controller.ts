import {
  Body,
  Controller,
  Post,
  Patch,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../common/casl/policies.guard';
import { CheckPolicies } from '../../../common/casl/check-policies.decorator';
import { Action } from '../../../common/casl/app-ability';
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
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('draft-cart') // 🔥 Modern route naming
export class DraftCartController {
  constructor(private readonly draftCartService: DraftCartService) {}

  // ─────────── Add or Update Draft Event ───────────
  @Post('add')
  @CheckPolicies((ability) => ability.can(Action.Create, 'DraftCart'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add or update an event in the draft cart' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Event successfully added/updated in draft cart',
  })
  async addToDraft(@CurrentUser() user: AuthUser, @Body() dto: AddToDraftDto) {
    const result = await this.draftCartService.addOrUpdateDraft(
      user.userId!,
      dto,
    );
    return {
      message: 'Event successfully added to draft cart.',
      data: result,
    };
  }

  // ─────────── Get User Draft Cart ───────────
  @Get()
  @CheckPolicies((ability) => ability.can(Action.Read, 'DraftCart'))
  async getDraftCart(@CurrentUser() user: AuthUser) {
    return this.draftCartService.getDraftCartByUser(user.userId!);
  }

  // // ─────────── Update Event Schedule ───────────
  @Patch('schedule')
  @CheckPolicies((ability) => ability.can(Action.Update, 'DraftCart'))
  async updateDraftSchedule(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDraftScheduleDto,
  ) {
    const updated = await this.draftCartService.updateDraftSchedule(
      user.userId!,
      dto,
    );
    return {
      message: 'Draft cart schedule updated successfully.',
      data: updated,
    };
  }

  // // ─────────── Update Addons ───────────
  @Patch('update-addon')
  @CheckPolicies((ability) => ability.can(Action.Update, 'DraftCart'))
  async updateDraftAddons(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDraftAddonsDto,
  ) {
    const updated = await this.draftCartService.updateDraftAddons(
      user.userId!,
      dto,
    );
    return {
      message: 'Draft cart addons updated successfully.',
      data: updated,
    };
  }
  @Patch('update-address')
  @CheckPolicies((ability) => ability.can(Action.Update, 'DraftCart'))
  async updateDraftAddress(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDraftAddressDto,
  ) {
    const updated = await this.draftCartService.updateDraftAddress(
      user.userId!,
      dto,
    );
    return {
      message: 'Draft cart addons updated successfully.',
      data: updated,
    };
  }

  /// directly service booking ////

  @Post('book-service')
  @CheckPolicies((ability) => ability.can(Action.Create, 'DraftCart'))
  async bookServiceOnly(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDraftAddonsDto,
  ) {
    const draft = await this.draftCartService.bookServiceOnly(
      user.userId!,
      dto,
    );

    return {
      message: 'Service added successfully.',
      data: draft,
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
  @CheckPolicies((ability) => ability.can(Action.Update, 'DraftCart'))
  async upgradeDraftEventTier(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDraftUpgradeEventTierDto,
  ) {
    const updated = await this.draftCartService.upgradeDraftEventTier(
      user.userId!,
      dto,
    );
    return {
      message: 'Draft cart addons updated successfully.',
      data: updated,
    };
  }

  @Get('upgrade-suggestions')
  @CheckPolicies((ability) => ability.can(Action.Read, 'DraftCart'))
  async getUpgradeSuggestions(@CurrentUser() user: AuthUser) {
    return this.draftCartService.getUpgradeSuggestions(user.userId!.toString());
  }

  @Get('planner-price')
  @CheckPolicies((ability) => ability.can(Action.Read, 'DraftCart'))
  async getPlannerPrice(@CurrentUser() user: AuthUser) {
    return this.draftCartService.getPlannerPrice(user.userId!);
  }
}
