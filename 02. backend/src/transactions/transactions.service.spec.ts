import { DataSource } from 'typeorm';
import { TransactionsService } from './transactions.service';
import { TransactionEntity } from './entities/transaction.entity';
import { MovementEntity } from './entities/movement.entity';
import { WalletEntity } from '@app/wallets/entities/wallet.entity';
import { WalletStatus } from '@app/common/enums/wallet-status.enum';
import { TransactionStatus } from '@app/common/enums/transaction-status.enum';
import { SimpleTransactionType, TransactionType } from '@app/common/enums/transaction-type.enum';
import {
  CurrencyMismatchException,
  InsufficientFundsException,
  SameWalletTransferException,
  TransactionAlreadyReversedException,
  TransactionNotFoundException,
  TransactionNotReversibleException,
  WalletNotActiveException,
  WalletNotFoundException,
} from '@app/common/exceptions/business.exceptions';

/**
 * Minimal in-memory fake of the TypeORM manager surface used by TransactionsService.
 * Lets us exercise the real business rules/atomicity flow without a database.
 */
function createFakeDataSource(
  seedWallets: WalletEntity[] = [],
  seedTransactions: TransactionEntity[] = [],
) {
  const wallets = new Map<string, WalletEntity>(seedWallets.map((w) => [w.id, { ...w }]));
  const transactions = new Map<string, TransactionEntity>(
    seedTransactions.map((t) => [t.id, { ...t }]),
  );
  const movements = new Map<string, MovementEntity>();

  const storeFor = (entityClass: unknown) => {
    if (entityClass === WalletEntity) return wallets;
    if (entityClass === TransactionEntity) return transactions;
    if (entityClass === MovementEntity) return movements;
    throw new Error('Unsupported entity in fake data source');
  };

  const manager = {
    findOne: jest.fn(async (entityClass: unknown, options: { where: { id: string } }) => {
      const store = storeFor(entityClass);
      return store.get(options.where.id) ?? null;
    }),
    update: jest.fn(
      async (entityClass: unknown, criteria: { id: string }, partial: Record<string, unknown>) => {
        const store = storeFor(entityClass) as unknown as Map<string, Record<string, unknown>>;
        const current = store.get(criteria.id);
        if (current) {
          store.set(criteria.id, { ...current, ...partial });
        }
      },
    ),
    getRepository: (entityClass: unknown) => ({
      create: (data: Record<string, unknown>) => ({ ...data }),
      save: async (entity: Record<string, unknown>) => {
        const store = storeFor(entityClass) as unknown as Map<string, Record<string, unknown>>;
        const saved = { ...entity, createdAt: new Date(), updatedAt: new Date() };
        store.set(entity.id as string, saved);
        return saved;
      },
    }),
  };

  const queryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager,
  };

  const dataSource = {
    createQueryRunner: () => queryRunner,
    manager,
  } as unknown as DataSource;

  return { dataSource, queryRunner, wallets, transactions, movements };
}

function buildWallet(overrides: Partial<WalletEntity> = {}): WalletEntity {
  return {
    id: 'wal_001',
    currency: 'PEN',
    availableBalance: '100.00',
    status: WalletStatus.ACTIVE,
    ownerName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// The idempotency wrapper is unit-tested in isolation; here we bypass it so tests
// focus purely on the transactional business rules.
const passthroughIdempotencyService = {
  run: jest.fn(
    async (
      _qr: unknown,
      _key: string,
      _endpoint: string,
      _payload: unknown,
      handler: () => Promise<{ statusCode: number; body: unknown }>,
    ) => {
      const { statusCode, body } = await handler();
      return { statusCode, body, replayed: false };
    },
  ),
};

const auditService = { record: jest.fn().mockResolvedValue(undefined) };

describe('TransactionsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTransaction', () => {
    it('debits a wallet and persists the resulting balance', async () => {
      const { dataSource, wallets } = createFakeDataSource([
        buildWallet({ availableBalance: '100.00' }),
      ]);
      const service = new TransactionsService(
        dataSource,
        passthroughIdempotencyService as never,
        auditService as never,
      );

      const result = await service.createTransaction(
        {
          walletId: 'wal_001',
          type: SimpleTransactionType.DEBIT,
          amount: '30.00',
          currency: 'PEN',
        },
        'idem-1',
        'senior.backend',
      );

      expect(result.statusCode).toBe(201);
      expect(result.body.status).toBe(TransactionStatus.COMPLETED);
      expect(wallets.get('wal_001')?.availableBalance).toBe('70.00');
      expect(auditService.record).toHaveBeenCalled();
    });

    it('credits a wallet and persists the resulting balance', async () => {
      const { dataSource, wallets } = createFakeDataSource([
        buildWallet({ availableBalance: '100.00' }),
      ]);
      const service = new TransactionsService(
        dataSource,
        passthroughIdempotencyService as never,
        auditService as never,
      );

      await service.createTransaction(
        {
          walletId: 'wal_001',
          type: SimpleTransactionType.CREDIT,
          amount: '30.00',
          currency: 'PEN',
        },
        'idem-1',
        'senior.backend',
      );

      expect(wallets.get('wal_001')?.availableBalance).toBe('130.00');
    });

    it('throws InsufficientFundsException and does not mutate the balance', async () => {
      const { dataSource, wallets } = createFakeDataSource([
        buildWallet({ availableBalance: '10.00' }),
      ]);
      const service = new TransactionsService(
        dataSource,
        passthroughIdempotencyService as never,
        auditService as never,
      );

      await expect(
        service.createTransaction(
          {
            walletId: 'wal_001',
            type: SimpleTransactionType.DEBIT,
            amount: '50.00',
            currency: 'PEN',
          },
          'idem-1',
          'senior.backend',
        ),
      ).rejects.toBeInstanceOf(InsufficientFundsException);
      expect(wallets.get('wal_001')?.availableBalance).toBe('10.00');
    });

    it('throws WalletNotActiveException for a blocked wallet', async () => {
      const { dataSource } = createFakeDataSource([buildWallet({ status: WalletStatus.BLOCKED })]);
      const service = new TransactionsService(
        dataSource,
        passthroughIdempotencyService as never,
        auditService as never,
      );

      await expect(
        service.createTransaction(
          {
            walletId: 'wal_001',
            type: SimpleTransactionType.DEBIT,
            amount: '5.00',
            currency: 'PEN',
          },
          'idem-1',
          'senior.backend',
        ),
      ).rejects.toBeInstanceOf(WalletNotActiveException);
    });

    it('throws WalletNotFoundException for a missing wallet', async () => {
      const { dataSource } = createFakeDataSource([]);
      const service = new TransactionsService(
        dataSource,
        passthroughIdempotencyService as never,
        auditService as never,
      );

      await expect(
        service.createTransaction(
          {
            walletId: 'wal_missing',
            type: SimpleTransactionType.DEBIT,
            amount: '5.00',
            currency: 'PEN',
          },
          'idem-1',
          'senior.backend',
        ),
      ).rejects.toBeInstanceOf(WalletNotFoundException);
    });

    it('throws CurrencyMismatchException when currencies differ', async () => {
      const { dataSource } = createFakeDataSource([buildWallet({ currency: 'PEN' })]);
      const service = new TransactionsService(
        dataSource,
        passthroughIdempotencyService as never,
        auditService as never,
      );

      await expect(
        service.createTransaction(
          {
            walletId: 'wal_001',
            type: SimpleTransactionType.DEBIT,
            amount: '5.00',
            currency: 'USD',
          },
          'idem-1',
          'senior.backend',
        ),
      ).rejects.toBeInstanceOf(CurrencyMismatchException);
    });

    it('rolls back the transaction when the business logic fails', async () => {
      const { dataSource, queryRunner } = createFakeDataSource([
        buildWallet({ availableBalance: '10.00' }),
      ]);
      const service = new TransactionsService(
        dataSource,
        passthroughIdempotencyService as never,
        auditService as never,
      );

      await expect(
        service.createTransaction(
          {
            walletId: 'wal_001',
            type: SimpleTransactionType.DEBIT,
            amount: '50.00',
            currency: 'PEN',
          },
          'idem-1',
          'senior.backend',
        ),
      ).rejects.toBeInstanceOf(InsufficientFundsException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('transfer', () => {
    it('moves funds from source to target atomically', async () => {
      const { dataSource, wallets } = createFakeDataSource([
        buildWallet({ id: 'wal_001', availableBalance: '200.00' }),
        buildWallet({ id: 'wal_002', availableBalance: '50.00' }),
      ]);
      const service = new TransactionsService(
        dataSource,
        passthroughIdempotencyService as never,
        auditService as never,
      );

      await service.transfer(
        { sourceWalletId: 'wal_001', targetWalletId: 'wal_002', amount: '75.00', currency: 'PEN' },
        'idem-1',
        'senior.backend',
      );

      expect(wallets.get('wal_001')?.availableBalance).toBe('125.00');
      expect(wallets.get('wal_002')?.availableBalance).toBe('125.00');
    });

    it('rejects a transfer to the same wallet before touching the database', async () => {
      const { dataSource } = createFakeDataSource([buildWallet({ id: 'wal_001' })]);
      const service = new TransactionsService(
        dataSource,
        passthroughIdempotencyService as never,
        auditService as never,
      );

      await expect(
        service.transfer(
          { sourceWalletId: 'wal_001', targetWalletId: 'wal_001', amount: '5.00', currency: 'PEN' },
          'idem-1',
          'senior.backend',
        ),
      ).rejects.toBeInstanceOf(SameWalletTransferException);
    });

    it('rejects a transfer with insufficient funds and leaves both balances untouched', async () => {
      const { dataSource, wallets } = createFakeDataSource([
        buildWallet({ id: 'wal_001', availableBalance: '10.00' }),
        buildWallet({ id: 'wal_002', availableBalance: '50.00' }),
      ]);
      const service = new TransactionsService(
        dataSource,
        passthroughIdempotencyService as never,
        auditService as never,
      );

      await expect(
        service.transfer(
          {
            sourceWalletId: 'wal_001',
            targetWalletId: 'wal_002',
            amount: '75.00',
            currency: 'PEN',
          },
          'idem-1',
          'senior.backend',
        ),
      ).rejects.toBeInstanceOf(InsufficientFundsException);

      expect(wallets.get('wal_001')?.availableBalance).toBe('10.00');
      expect(wallets.get('wal_002')?.availableBalance).toBe('50.00');
    });
  });

  describe('reverse', () => {
    it('reverses a completed debit and restores the balance', async () => {
      const original: TransactionEntity = {
        id: 'txn_001',
        type: TransactionType.DEBIT,
        status: TransactionStatus.COMPLETED,
        walletId: 'wal_001',
        targetWalletId: null,
        amount: '40.00',
        currency: 'PEN',
        description: null,
        externalReference: null,
        idempotencyKey: 'idem-original',
        reversalOfTransactionId: null,
        reversedByTransactionId: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const { dataSource, wallets, transactions } = createFakeDataSource(
        [buildWallet({ id: 'wal_001', availableBalance: '60.00' })],
        [original],
      );
      const service = new TransactionsService(
        dataSource,
        passthroughIdempotencyService as never,
        auditService as never,
      );

      const result = await service.reverse(
        'txn_001',
        { reason: 'refund' },
        'idem-2',
        'senior.backend',
      );

      expect(result.body.type).toBe(TransactionType.REVERSAL);
      expect(wallets.get('wal_001')?.availableBalance).toBe('100.00');
      expect(transactions.get('txn_001')?.status).toBe(TransactionStatus.REVERSED);
      expect(transactions.get('txn_001')?.reversedByTransactionId).toBe(result.body.transactionId);
    });

    it('throws TransactionNotFoundException for an unknown transaction', async () => {
      const { dataSource } = createFakeDataSource([]);
      const service = new TransactionsService(
        dataSource,
        passthroughIdempotencyService as never,
        auditService as never,
      );

      await expect(
        service.reverse('txn_missing', { reason: 'x' }, 'idem-2', 'senior.backend'),
      ).rejects.toBeInstanceOf(TransactionNotFoundException);
    });

    it('throws TransactionAlreadyReversedException on double reversal', async () => {
      const original: TransactionEntity = {
        id: 'txn_001',
        type: TransactionType.DEBIT,
        status: TransactionStatus.REVERSED,
        walletId: 'wal_001',
        targetWalletId: null,
        amount: '40.00',
        currency: 'PEN',
        description: null,
        externalReference: null,
        idempotencyKey: 'idem-original',
        reversalOfTransactionId: null,
        reversedByTransactionId: 'txn_002',
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const { dataSource } = createFakeDataSource([buildWallet({ id: 'wal_001' })], [original]);
      const service = new TransactionsService(
        dataSource,
        passthroughIdempotencyService as never,
        auditService as never,
      );

      await expect(
        service.reverse('txn_001', { reason: 'x' }, 'idem-2', 'senior.backend'),
      ).rejects.toBeInstanceOf(TransactionAlreadyReversedException);
    });

    it('throws TransactionNotReversibleException when reversing a REVERSAL', async () => {
      const reversalTxn: TransactionEntity = {
        id: 'txn_002',
        type: TransactionType.REVERSAL,
        status: TransactionStatus.COMPLETED,
        walletId: 'wal_001',
        targetWalletId: null,
        amount: '40.00',
        currency: 'PEN',
        description: null,
        externalReference: null,
        idempotencyKey: 'idem-original',
        reversalOfTransactionId: 'txn_001',
        reversedByTransactionId: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const { dataSource } = createFakeDataSource([buildWallet({ id: 'wal_001' })], [reversalTxn]);
      const service = new TransactionsService(
        dataSource,
        passthroughIdempotencyService as never,
        auditService as never,
      );

      await expect(
        service.reverse('txn_002', { reason: 'x' }, 'idem-2', 'senior.backend'),
      ).rejects.toBeInstanceOf(TransactionNotReversibleException);
    });
  });
});
