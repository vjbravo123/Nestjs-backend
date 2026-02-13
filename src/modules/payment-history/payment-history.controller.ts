import { 
    Controller, 
    Post, 
    Patch, 
    Get, 
    Body, 
    Param, 
    UseGuards, 
    BadRequestException
} from '@nestjs/common';
import { PaymentHistoryService } from './payment-history.service';
import { CreateHistoryDto } from './dto/create-history.dto';
import { UpdateHistoryStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('payment-history')
export class PaymentHistoryController {

    constructor(private readonly historyService: PaymentHistoryService) {}

    @Post()
    @UseGuards(JwtAuthGuard , RolesGuard)
    @Roles('admin' ,'user')
    async createHistory(@CurrentUser() user: any, @Body() dto: CreateHistoryDto){
    const userId = user?.userId;
    if (!userId) throw new BadRequestException('User ID missing');
    return this.historyService.createSchedule(userId, dto);
}

    @Patch('status')
    @UseGuards(JwtAuthGuard , RolesGuard)
    @Roles('admin' ,'user')
    async updateStatus(@Body() dto: UpdateHistoryStatusDto) {
        return this.historyService.updateMilestoneStatus(dto);
    }

    @Get(':orderId')
    @UseGuards(JwtAuthGuard , RolesGuard)
    @Roles('admin')
    async getBookingHistory(@Param('orderId') orderId: string) {
        return this.historyService.getHistoryByOrder(orderId);
    }
    
    @Get('user/all')
    @UseGuards(JwtAuthGuard , RolesGuard)
    @Roles('user')
    async getMyHistory(@CurrentUser() user: any) {
        const userId = user?.userId;
        if (!userId) throw new BadRequestException('User ID required');
        
        return this.historyService.getUserHistory(userId);
    }
}