import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTransactionDto } from '@app/transactions/dto/create-transaction.dto';
import { TransferDto } from '@app/transactions/dto/transfer.dto';
import { ReversalDto } from '@app/transactions/dto/reversal.dto';
import { LoginDto } from '@app/auth/dto/login.dto';
import { BalanceQueryDto } from '@app/wallets/dto/balance-query.dto';
import { MovementsQueryDto } from '@app/wallets/dto/movements-query.dto';

/**
 * UNIT TESTS — DTO validation (class-validator), fully isolated: no Nest
 * application, no HTTP layer, no database. These complement the e2e tests
 * (which assert the resulting 400 response through the full pipeline) by
 * verifying, at the unit level, exactly WHICH constraint of WHICH DTO field
 * rejects each invalid input — the "validaciones" leg of the testing
 * pyramid required by the challenge (business rules + validations +
 * idempotency, each with dedicated unit coverage).
 */
describe('DTO validation (class-validator)', () => {
  describe('CreateTransactionDto', () => {
    const valid = {
      walletId: 'wal_001',
      type: 'DEBIT',
      amount: '25.50',
      currency: 'PEN',
    };

    it('accepts a well-formed payload', async () => {
      const dto = plainToInstance(CreateTransactionDto, valid);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects a float-shaped amount with more than 2 decimal places (never float for money)', async () => {
      const dto = plainToInstance(CreateTransactionDto, { ...valid, amount: '25.505' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('rejects a negative amount', async () => {
      const dto = plainToInstance(CreateTransactionDto, { ...valid, amount: '-10.00' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('rejects zero as amount', async () => {
      const dto = plainToInstance(CreateTransactionDto, { ...valid, amount: '0.00' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('rejects a numeric (non-string) amount, since money must always travel as a string', async () => {
      const dto = plainToInstance(CreateTransactionDto, { ...valid, amount: 25.5 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('rejects a type outside the DEBIT/CREDIT enum', async () => {
      const dto = plainToInstance(CreateTransactionDto, { ...valid, type: 'WITHDRAWAL' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'type')).toBe(true);
    });

    it('rejects a currency code that is not exactly 3 characters', async () => {
      const dto = plainToInstance(CreateTransactionDto, { ...valid, currency: 'SOLES' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'currency')).toBe(true);
    });

    it('rejects a missing walletId', async () => {
      const { walletId, ...withoutWalletId } = valid;
      const dto = plainToInstance(CreateTransactionDto, withoutWalletId);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'walletId')).toBe(true);
    });
  });

  describe('TransferDto', () => {
    it('accepts a well-formed transfer payload', async () => {
      const dto = plainToInstance(TransferDto, {
        sourceWalletId: 'wal_001',
        targetWalletId: 'wal_002',
        amount: '100.00',
        currency: 'PEN',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects a missing targetWalletId', async () => {
      const dto = plainToInstance(TransferDto, {
        sourceWalletId: 'wal_001',
        amount: '100.00',
        currency: 'PEN',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'targetWalletId')).toBe(true);
    });
  });

  describe('ReversalDto', () => {
    it('accepts a well-formed reversal payload', async () => {
      const dto = plainToInstance(ReversalDto, { transactionId: 'txn_001', reason: 'Refund' });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects a missing reason', async () => {
      const dto = plainToInstance(ReversalDto, { transactionId: 'txn_001' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reason')).toBe(true);
    });
  });

  describe('LoginDto', () => {
    it('accepts well-formed credentials', async () => {
      const dto = plainToInstance(LoginDto, { username: 'senior.backend', password: 'Password123' });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects an empty password', async () => {
      const dto = plainToInstance(LoginDto, { username: 'senior.backend', password: '' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });
  });

  describe('BalanceQueryDto (GET uses query params, never path params)', () => {
    it('rejects a missing walletId', async () => {
      const dto = plainToInstance(BalanceQueryDto, {});
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'walletId')).toBe(true);
    });
  });

  describe('MovementsQueryDto', () => {
    it('applies default pagination when omitted', () => {
      const dto = plainToInstance(MovementsQueryDto, { walletId: 'wal_001' });
      expect(dto.page).toBe(1);
      expect(dto.pageSize).toBe(20);
    });

    it('rejects a pageSize above the maximum of 100', async () => {
      const dto = plainToInstance(MovementsQueryDto, { walletId: 'wal_001', pageSize: 500 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'pageSize')).toBe(true);
    });

    it('rejects a page below 1', async () => {
      const dto = plainToInstance(MovementsQueryDto, { walletId: 'wal_001', page: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });
  });
});
