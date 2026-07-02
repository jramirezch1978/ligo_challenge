import { QueryRunner } from 'typeorm';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyRecordStatus } from '@app/common/enums/idempotency-status.enum';
import {
  IdempotencyConflictException,
  IdempotencyInProgressException,
} from '@app/common/exceptions/business.exceptions';

function buildQueryRunner(repositoryOverrides: Record<string, jest.Mock> = {}) {
  const repository = {
    insert: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    ...repositoryOverrides,
  };

  const queryRunner = {
    manager: {
      getRepository: () => repository,
      findOne: jest.fn(),
    },
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  } as unknown as QueryRunner;

  return { queryRunner, repository };
}

describe('IdempotencyService', () => {
  let service: IdempotencyService;

  beforeEach(() => {
    service = new IdempotencyService();
  });

  it('executes the handler and persists the response on first execution', async () => {
    const { queryRunner, repository } = buildQueryRunner();
    const handler = jest.fn().mockResolvedValue({ statusCode: 201, body: { ok: true } });

    const result = await service.run(queryRunner, 'key-1', 'POST:/transactions', { a: 1 }, handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ statusCode: 201, body: { ok: true }, replayed: false });
    expect(repository.update).toHaveBeenCalledWith(
      { idempotencyKey: 'key-1', endpoint: 'POST:/transactions' },
      {
        status: IdempotencyRecordStatus.COMPLETED,
        responseStatus: 201,
        responseBody: { ok: true },
      },
    );
  });

  it('replays the stored response without re-executing the handler when the payload matches', async () => {
    const uniqueViolation = Object.assign(new Error('duplicate'), { code: '23505' });
    const repositoryInsert = jest.fn().mockRejectedValue(uniqueViolation);
    const { queryRunner } = buildQueryRunner({ insert: repositoryInsert });
    const requestHash = service.hashPayload({ a: 1 });

    (queryRunner.manager.findOne as jest.Mock).mockResolvedValue({
      status: IdempotencyRecordStatus.COMPLETED,
      requestHash,
      responseStatus: 201,
      responseBody: { ok: true },
    });

    const handler = jest.fn();
    const result = await service.run(queryRunner, 'key-1', 'POST:/transactions', { a: 1 }, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(result).toEqual({ statusCode: 201, body: { ok: true }, replayed: true });
  });

  it('throws a conflict when the same key is reused with a different payload', async () => {
    const uniqueViolation = Object.assign(new Error('duplicate'), { code: '23505' });
    const { queryRunner } = buildQueryRunner({
      insert: jest.fn().mockRejectedValue(uniqueViolation),
    });

    (queryRunner.manager.findOne as jest.Mock).mockResolvedValue({
      status: IdempotencyRecordStatus.COMPLETED,
      requestHash: 'a-different-hash',
      responseStatus: 201,
      responseBody: {},
    });

    await expect(
      service.run(queryRunner, 'key-1', 'POST:/transactions', { a: 1 }, jest.fn()),
    ).rejects.toBeInstanceOf(IdempotencyConflictException);
  });

  it('throws an in-progress conflict for a concurrent duplicate request', async () => {
    const uniqueViolation = Object.assign(new Error('duplicate'), { code: '23505' });
    const { queryRunner } = buildQueryRunner({
      insert: jest.fn().mockRejectedValue(uniqueViolation),
    });

    (queryRunner.manager.findOne as jest.Mock).mockResolvedValue({
      status: IdempotencyRecordStatus.PROCESSING,
      requestHash: 'whatever',
    });

    await expect(
      service.run(queryRunner, 'key-1', 'POST:/transactions', { a: 1 }, jest.fn()),
    ).rejects.toBeInstanceOf(IdempotencyInProgressException);
  });

  it('propagates unrelated database errors', async () => {
    const otherError = Object.assign(new Error('connection lost'), { code: '08006' });
    const { queryRunner } = buildQueryRunner({ insert: jest.fn().mockRejectedValue(otherError) });

    await expect(
      service.run(queryRunner, 'key-1', 'POST:/transactions', {}, jest.fn()),
    ).rejects.toThrow('connection lost');
  });
});
