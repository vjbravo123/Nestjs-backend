import { 
    Controller, 
    Post, 
    Patch, 
    Get, 
    Body, 
    Param, 
    UseGuards, 
    BadRequestException,
    Logger
} from '@nestjs/common';
import { PaymentHistoryService } from './payment-history.service';
import { CreateHistoryDto } from './dto/create-history.dto';
import { UpdateHistoryStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';



@Controller('payment-history')
export class PaymentHistoryController {

    constructor(private readonly historyService: PaymentHistoryService) {}

   
    //1. Create Schedule
    @Post()
    @UseGuards(JwtAuthGuard)
    async createHistory(@CurrentUser() user: any, @Body() dto: CreateHistoryDto){

        const id = user?.userId;
        console.log(id);
        
        if (!id) {
            throw new BadRequestException('User ID required - Ensure Token is passed in Header');
        }

        return this.historyService.createSchedule(id, dto);
    }

   
    //2. Mark Paid
    @Patch('status')
    async updateStatus(@Body() dto: UpdateHistoryStatusDto) {
        console.log(dto);
        return this.historyService.updateMilestoneStatus(dto);
    }

   
    //3. Get Specific Booking History
    @Get(':checkoutIntentId')
    @UseGuards(JwtAuthGuard)
    async getBookingHistory(@Param('checkoutIntentId') id: string) {
        return this.historyService.getHistory(id);
    }

    
    //4. Get All Histories of the user logged in
    @Get('user/all')
    @UseGuards(JwtAuthGuard)
    async getMyHistory(@CurrentUser() user: any) {
        const id = user?.userId;
        if (!id) throw new BadRequestException('User ID required');
        
        return this.historyService.getUserHistory(id);
    }
}