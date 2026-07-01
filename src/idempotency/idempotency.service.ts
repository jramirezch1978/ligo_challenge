import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { QueryRunner } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IdempotencyKeyEntity } from './entities/idempotency-key.entity';
import { IdempotencyRecordStatus } from '@app/common/enums/idempotency-status.enum';
import {
  IdempotencyConflictException,
  IdempotencyInProgressException,
} from '@app/common/exceptions/business.exceptions';

export interface IdempotentResult<T> {
  statusCode: number;
  body: T;
  replayed: boolean;
}

const UNIQUE_VIOLATION_CODE = '23505';

/**
 * Guarantees "exactly-once" semantics for critical write operations.
 *
 * The idempotency row is inserted/updated using the SAME database transaction
 * (QueryRunner) as the business logic it protects. This means: if the business
 * operation fails and the transaction rolls back, the idempotency record rolls
 * back too, so the key becomes available for a legitimate retry. If it succeeds,
 * both the business effects and the cached response are committed atomically.
 */
@Injectable()
export class IdempotencyService {
  hashPayload(payload: unknown): string {
    const normalized = JSON.stringify(payload ?? {});
    return createHash('sha256').update(normalized).digest('hex');
  }

  async run<T>(
    queryRunner: QueryRunner,
    idempotencyKey: string,
    endpoint: string,
    requestPayload: unknown,
    handler: () => Promise<{ statusCode: number; body: T }>,
  ): Promise<IdempotentResult<T>> {
    const requestHash = this.hashPayload(requestPayload);
    const repository = queryRunner.manager.getRepository(IdempotencyKeyEntity);

    try {
      await repository.insert({
        idempotencyKey,
        endpoint,
        requestHash,
        status: IdempotencyRecordStatus.PROCESSING,
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        return this.resolveExistingRecord<T>(queryRunner, idempotencyKey, endpoint, requestHash);
      }
      throw error;
    }

    const { statusCode, body } = await handler();

    await repository.update({ idempotencyKey, endpoint }, {
      status: IdempotencyRecordStatus.COMPLETED,
      responseStatus: statusCode,
      responseBody: body,
    } as QueryDeepPartialEntity<IdempotencyKeyEntity>);

    return { statusCode, body, replayed: false };
  }

  private async resolveExistingRecord<T>(
    queryRunner: QueryRunner,
    idempotencyKey: string,
    endpoint: string,
    requestHash: string,
  ): Promise<IdempotentResult<T>> {
    const existing = await queryRunner.manager.findOne(IdempotencyKeyEntity, {
      where: { idempotencyKey, endpoint },
    });

    if (!existing) {
      // Extremely unlikely race (deleted between insert failure and lookup); fail closed.
      throw new IdempotencyInProgressException();
    }

    if (existing.status === IdempotencyRecordStatus.PROCESSING) {
      throw new IdempotencyInProgressException();
    }

    if (existing.requestHash !== requestHash) {
      throw new IdempotencyConflictException();
    }

    return {
      statusCode: existing.responseStatus ?? 200,
      body: existing.responseBody as T,
      replayed: true,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === UNIQUE_VIOLATION_CODE
    );
  }
}
