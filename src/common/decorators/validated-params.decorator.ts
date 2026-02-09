import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export const ValidatedParams = (dto: any) =>
    createParamDecorator((data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const params = request.params;

        const instance = plainToInstance(dto, params);
        const errors = validateSync(instance, { whitelist: true });

        if (errors.length > 0) {
            const messages = errors
                .map(err =>
                    err.constraints ? Object.values(err.constraints) : ['Invalid input'],
                )
                .flat();

            throw new BadRequestException(messages);
        }

        return instance;
    })();
