import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class Msg91Service {
    private readonly logger = new Logger(Msg91Service.name);

    private readonly AUTH_KEY = process.env.MSG91_AUTH_KEY || '';
    private readonly INTEGRATED_NUMBER = '15557093126';
    private readonly TEMPLATE_NAMESPACE = 'ea16c768_3401_4afe_aaa3_34759654ba31';
    private readonly TEMPLATE_NAME = 'zappyotp';

    async sendOtp(phone: string | number, otp: string | number) {
        const formatedMobile = `+91${phone}`;
        console.log('phone and otp', phone, otp);
        try {
            const url =
                'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

            const payload = {
                integrated_number: this.INTEGRATED_NUMBER,
                content_type: 'template',
                payload: {
                    messaging_product: 'whatsapp',
                    type: 'template',
                    template: {
                        name: this.TEMPLATE_NAME,
                        language: {
                            code: 'en_US',
                            policy: 'deterministic',
                        },
                        namespace: this.TEMPLATE_NAMESPACE,
                        to_and_components: [
                            {
                                to: [`${formatedMobile}`],
                                components: {
                                    body_1: {
                                        type: 'text',
                                        value: `${otp}`, // Mapped to {{1}}
                                    },
                                    button_1: {

                                        subtype: "url",

                                        type: "text",

                                        value: `${otp}`, // Mapped to {{1}}

                                    }
                                },
                            },
                        ],
                    },
                },
            };

            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    authkey: this.AUTH_KEY,
                },
            });

            this.logger.log('MSG91 OTP Response: ' + JSON.stringify(response.data));

            return response.data;
        } catch (error: any) {
            this.logger.error(
                'MSG91 OTP Send Error: ' +
                (error.response?.data ? JSON.stringify(error.response.data) : error.message),
            );
            throw error;
        }
    }
}
