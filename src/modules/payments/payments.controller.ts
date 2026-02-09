import {
    Body,
    Controller,
    Post,
    Get,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    BadRequestException,
    Headers,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { MongoIdPipe } from '../../common/pipes/parse-objectid.pipe';

@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    // ==================================================
    // 🟢 INITIATE PAYMENT (FROM CHECKOUT PAGE)
    // ==================================================
    @Post('initiate')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    async initiatePayment(
        @CurrentUser() { userId }: AuthUser,
        @Body() dto: InitiatePaymentDto,
    ) {
        if (!userId) {
            throw new BadRequestException('User id required');
        }

        return this.paymentsService.initiatePayment(userId, dto);
    }

    // // ==================================================
    // // 🔴 PHONEPE WEBHOOK (SERVER → SERVER)
    // // ==================================================
    // @Post('webhook/phonepe')
    // @HttpCode(HttpStatus.OK)
    // async phonePeWebhook(
    //     @Body() payload: any,
    //     @Headers('authorization') authorization: string,
    // ) {
    //     console.log('🔥 PHONEPE WEBHOOK HIT');
    //     console.log('Headers authorization:', authorization);
    //     console.log('Payload:', JSON.stringify(payload));

    //     await this.paymentsService.handlePhonePeWebhook(
    //         payload,
    //         authorization,
    //     );

    //     return { success: true };
    // }

    @Get('status/:merchantOrderId')
    async checkStatus(@Param('merchantOrderId') merchantOrderId: string) {
        return this.paymentsService.checkPaymentStatusAndFinalize(merchantOrderId);
    }
    // ==================================================
    // 🔍 GET PAYMENT BY ID (OWNER ONLY)
    // ==================================================
    @Get(':paymentId')
    @UseGuards(JwtAuthGuard)
    async getPayment(
        @CurrentUser() { userId }: AuthUser,
        @Param('paymentId', MongoIdPipe) paymentId: string,
    ) {
        if (!userId) {
            throw new BadRequestException('User id required');
        }

        return this.paymentsService.getPaymentById(paymentId, userId);
    }

    // ==================================================
    // 📜 USER PAYMENT HISTORY
    // ==================================================
    @Get()
    @UseGuards(JwtAuthGuard)
    async getUserPayments(
        @CurrentUser() { userId }: AuthUser,
        @Query('limit') limit = 10,
        @Query('skip') skip = 0,
    ) {
        if (!userId) {
            throw new BadRequestException('User id required');
        }

        return this.paymentsService.getUserPayments(
            userId,
            Number(limit),
            Number(skip),
        );
    }
}
