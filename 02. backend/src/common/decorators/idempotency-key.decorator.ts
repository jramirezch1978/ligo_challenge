import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { IdempotencyKeyRequiredException } from '@app/common/exceptions/business.exceptions';

export const IDEMPOTENCY_HEADER = 'idempotency-key';

/** Extracts and validates the mandatory `Idempotency-Key` header for critical operations. */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const header = request.headers[IDEMPOTENCY_HEADER];
    const value = Array.isArray(header) ? header[0] : header;

    if (!value || value.trim().length === 0) {
      throw new IdempotencyKeyRequiredException();
    }

    if (value.length > 128) {
      throw new IdempotencyKeyRequiredException();
    }

    return value.trim();
  },
);
