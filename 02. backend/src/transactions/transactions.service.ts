import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { WalletEntity } from '@app/wallets/entities/wallet.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { MovementEntity } from './entities/movement.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransferDto } from './dto/transfer.dto';
import { ReversalDto } from './dto/reversal.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { TransactionStatusResponseDto } from './dto/transaction-status-response.dto';
import { IdempotencyService } from '@app/idempotency/idempotency.service';
import { AuditService } from '@app/audit/audit.service';
import { WalletStatus } from '@app/common/enums/wallet-status.enum';
import { TransactionStatus } from '@app/common/enums/transaction-status.enum';
import { TransactionType } from '@app/common/enums/transaction-type.enum';
import { MovementType } from '@app/common/enums/movement-type.enum';
import { Money } from '@app/common/utils/money.util';
import { generateId } from '@app/common/utils/id.util';
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

const ENDPOINTS = {
  CREATE: 'POST:/transactions',
  TRANSFER: 'POST:/transactions/transfer',
  REVERSAL: (id: string) => `POST:/transactions/${id}/reversal`,
};

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly idempotencyService: IdempotencyService,
    private readonly auditService: AuditService,
  ) {}

  async createTransaction(
    dto: CreateTransactionDto,
    idempotencyKey: string,
    performedBy: string,
  ): Promise<{ statusCode: number; body: TransactionResponseDto; replayed: boolean }> {
    return this.withTransaction(async (queryRunner) => {
      const result = await this.idempotencyService.run(
        queryRunner,
        idempotencyKey,
        ENDPOINTS.CREATE,
        dto,
        async () => {
          const wallet = await this.lockWallet(queryRunner, dto.walletId);
          this.assertWalletOperable(wallet, dto.currency);

          const amount = Money.of(dto.amount);
          const currentBalance = Money.of(wallet.availableBalance);
          const movementType = dto.type === 'DEBIT' ? MovementType.DEBIT : MovementType.CREDIT;

          let newBalance: Money;
          if (movementType === MovementType.DEBIT) {
            if (currentBalance.isLessThan(amount)) {
              throw new InsufficientFundsException(wallet.id);
            }
            newBalance = currentBalance.subtract(amount);
          } else {
            newBalance = currentBalance.add(amount);
          }

          const transactionId = generateId('txn');
          await this.persistBalance(queryRunner, wallet.id, newBalance);

          const transaction = await this.saveTransaction(queryRunner, {
            id: transactionId,
            type:
              movementType === MovementType.DEBIT ? TransactionType.DEBIT : TransactionType.CREDIT,
            status: TransactionStatus.COMPLETED,
            walletId: wallet.id,
            amount: amount.toString(),
            currency: dto.currency,
            description: dto.description ?? null,
            externalReference: dto.externalReference ?? null,
            idempotencyKey,
          });

          await this.saveMovement(queryRunner, {
            transactionId,
            walletId: wallet.id,
            type: movementType,
            amount: amount.toString(),
            balanceAfter: newBalance.toString(),
          });

          await this.auditService.record(queryRunner, {
            action: `TRANSACTION_${transaction.type}_CREATED`,
            entityType: 'Transaction',
            entityId: transactionId,
            performedBy,
            metadata: { walletId: wallet.id, amount: amount.toString(), currency: dto.currency },
          });

          return { statusCode: 201, body: this.toTransactionResponse(transaction) };
        },
      );

      return result;
    });
  }

  async transfer(
    dto: TransferDto,
    idempotencyKey: string,
    performedBy: string,
  ): Promise<{ statusCode: number; body: TransactionResponseDto; replayed: boolean }> {
    if (dto.sourceWalletId === dto.targetWalletId) {
      throw new SameWalletTransferException();
    }

    return this.withTransaction(async (queryRunner) => {
      return this.idempotencyService.run(
        queryRunner,
        idempotencyKey,
        ENDPOINTS.TRANSFER,
        dto,
        async () => {
          // Lock wallets in a deterministic order to prevent deadlocks between concurrent opposite transfers.
          const [firstId, secondId] = [dto.sourceWalletId, dto.targetWalletId].sort();
          const firstWallet = await this.lockWallet(queryRunner, firstId);
          const secondWallet = await this.lockWallet(queryRunner, secondId);

          const sourceWallet = firstWallet.id === dto.sourceWalletId ? firstWallet : secondWallet;
          const targetWallet = firstWallet.id === dto.targetWalletId ? firstWallet : secondWallet;

          this.assertWalletOperable(sourceWallet, dto.currency);
          this.assertWalletOperable(targetWallet, dto.currency);

          const amount = Money.of(dto.amount);
          const sourceBalance = Money.of(sourceWallet.availableBalance);
          if (sourceBalance.isLessThan(amount)) {
            throw new InsufficientFundsException(sourceWallet.id);
          }

          const newSourceBalance = sourceBalance.subtract(amount);
          const newTargetBalance = Money.of(targetWallet.availableBalance).add(amount);

          await this.persistBalance(queryRunner, sourceWallet.id, newSourceBalance);
          await this.persistBalance(queryRunner, targetWallet.id, newTargetBalance);

          const transactionId = generateId('txn');
          const transaction = await this.saveTransaction(queryRunner, {
            id: transactionId,
            type: TransactionType.TRANSFER,
            status: TransactionStatus.COMPLETED,
            walletId: sourceWallet.id,
            targetWalletId: targetWallet.id,
            amount: amount.toString(),
            currency: dto.currency,
            description: dto.description ?? null,
            externalReference: dto.externalReference ?? null,
            idempotencyKey,
          });

          await this.saveMovement(queryRunner, {
            transactionId,
            walletId: sourceWallet.id,
            type: MovementType.DEBIT,
            amount: amount.toString(),
            balanceAfter: newSourceBalance.toString(),
          });
          await this.saveMovement(queryRunner, {
            transactionId,
            walletId: targetWallet.id,
            type: MovementType.CREDIT,
            amount: amount.toString(),
            balanceAfter: newTargetBalance.toString(),
          });

          await this.auditService.record(queryRunner, {
            action: 'TRANSACTION_TRANSFER_CREATED',
            entityType: 'Transaction',
            entityId: transactionId,
            performedBy,
            metadata: {
              sourceWalletId: sourceWallet.id,
              targetWalletId: targetWallet.id,
              amount: amount.toString(),
              currency: dto.currency,
            },
          });

          return { statusCode: 201, body: this.toTransactionResponse(transaction) };
        },
      );
    });
  }

  async reverse(
    transactionId: string,
    dto: ReversalDto,
    idempotencyKey: string,
    performedBy: string,
  ): Promise<{ statusCode: number; body: TransactionResponseDto; replayed: boolean }> {
    return this.withTransaction(async (queryRunner) => {
      return this.idempotencyService.run(
        queryRunner,
        idempotencyKey,
        ENDPOINTS.REVERSAL(transactionId),
        dto,
        async () => {
          const original = await queryRunner.manager.findOne(TransactionEntity, {
            where: { id: transactionId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!original) {
            throw new TransactionNotFoundException(transactionId);
          }
          if (original.reversedByTransactionId) {
            throw new TransactionAlreadyReversedException(transactionId);
          }
          if (
            original.status !== TransactionStatus.COMPLETED ||
            original.type === TransactionType.REVERSAL
          ) {
            throw new TransactionNotReversibleException(transactionId);
          }

          const amount = Money.of(original.amount);
          const reversalId = generateId('txn');

          if (original.type === TransactionType.TRANSFER && original.targetWalletId) {
            const [firstId, secondId] = [original.walletId, original.targetWalletId].sort();
            const firstWallet = await this.lockWallet(queryRunner, firstId);
            const secondWallet = await this.lockWallet(queryRunner, secondId);
            const sourceWallet = firstWallet.id === original.walletId ? firstWallet : secondWallet;
            const targetWallet =
              firstWallet.id === original.targetWalletId ? firstWallet : secondWallet;

            // Reversal of a transfer: money flows back from target to source.
            const newTargetBalance = Money.of(targetWallet.availableBalance).subtract(amount);
            if (newTargetBalance.isNegative()) {
              throw new InsufficientFundsException(targetWallet.id);
            }
            const newSourceBalance = Money.of(sourceWallet.availableBalance).add(amount);

            await this.persistBalance(queryRunner, targetWallet.id, newTargetBalance);
            await this.persistBalance(queryRunner, sourceWallet.id, newSourceBalance);

            const reversal = await this.saveTransaction(queryRunner, {
              id: reversalId,
              type: TransactionType.REVERSAL,
              status: TransactionStatus.COMPLETED,
              walletId: sourceWallet.id,
              targetWalletId: targetWallet.id,
              amount: amount.toString(),
              currency: original.currency,
              description: dto.reason,
              externalReference: dto.externalReference ?? null,
              idempotencyKey,
              reversalOfTransactionId: original.id,
            });

            await this.saveMovement(queryRunner, {
              transactionId: reversalId,
              walletId: targetWallet.id,
              type: MovementType.DEBIT,
              amount: amount.toString(),
              balanceAfter: newTargetBalance.toString(),
            });
            await this.saveMovement(queryRunner, {
              transactionId: reversalId,
              walletId: sourceWallet.id,
              type: MovementType.CREDIT,
              amount: amount.toString(),
              balanceAfter: newSourceBalance.toString(),
            });

            await this.markReversed(queryRunner, original.id, reversalId);
            await this.auditService.record(queryRunner, {
              action: 'TRANSACTION_REVERSED',
              entityType: 'Transaction',
              entityId: original.id,
              performedBy,
              metadata: { reversalId, reason: dto.reason },
            });

            return { statusCode: 201, body: this.toTransactionResponse(reversal) };
          }

          // Reversal of a simple DEBIT/CREDIT: apply the inverse movement on the same wallet.
          const wallet = await this.lockWallet(queryRunner, original.walletId);
          const currentBalance = Money.of(wallet.availableBalance);
          const isInverseDebit = original.type === TransactionType.CREDIT;
          let newBalance: Money;
          if (isInverseDebit) {
            if (currentBalance.isLessThan(amount)) {
              throw new InsufficientFundsException(wallet.id);
            }
            newBalance = currentBalance.subtract(amount);
          } else {
            newBalance = currentBalance.add(amount);
          }

          await this.persistBalance(queryRunner, wallet.id, newBalance);

          const reversal = await this.saveTransaction(queryRunner, {
            id: reversalId,
            type: TransactionType.REVERSAL,
            status: TransactionStatus.COMPLETED,
            walletId: wallet.id,
            amount: amount.toString(),
            currency: original.currency,
            description: dto.reason,
            externalReference: dto.externalReference ?? null,
            idempotencyKey,
            reversalOfTransactionId: original.id,
          });

          await this.saveMovement(queryRunner, {
            transactionId: reversalId,
            walletId: wallet.id,
            type: isInverseDebit ? MovementType.DEBIT : MovementType.CREDIT,
            amount: amount.toString(),
            balanceAfter: newBalance.toString(),
          });

          await this.markReversed(queryRunner, original.id, reversalId);
          await this.auditService.record(queryRunner, {
            action: 'TRANSACTION_REVERSED',
            entityType: 'Transaction',
            entityId: original.id,
            performedBy,
            metadata: { reversalId, reason: dto.reason },
          });

          return { statusCode: 201, body: this.toTransactionResponse(reversal) };
        },
      );
    });
  }

  async getStatus(transactionId: string): Promise<TransactionStatusResponseDto> {
    const transaction = await this.dataSource.manager.findOne(TransactionEntity, {
      where: { id: transactionId },
    });
    if (!transaction) {
      throw new TransactionNotFoundException(transactionId);
    }
    return {
      transactionId: transaction.id,
      status: transaction.status,
      externalReference: transaction.externalReference ?? null,
    };
  }

  // ---- helpers -----------------------------------------------------------

  private async withTransaction<T>(work: (queryRunner: QueryRunner) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');
    try {
      const result = await work(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async lockWallet(queryRunner: QueryRunner, walletId: string): Promise<WalletEntity> {
    const wallet = await queryRunner.manager.findOne(WalletEntity, {
      where: { id: walletId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!wallet) {
      throw new WalletNotFoundException(walletId);
    }
    return wallet;
  }

  private assertWalletOperable(wallet: WalletEntity, currency: string): void {
    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new WalletNotActiveException(wallet.id);
    }
    if (wallet.currency !== currency) {
      throw new CurrencyMismatchException();
    }
  }

  private async persistBalance(
    queryRunner: QueryRunner,
    walletId: string,
    balance: Money,
  ): Promise<void> {
    await queryRunner.manager.update(
      WalletEntity,
      { id: walletId },
      { availableBalance: balance.toString() },
    );
  }

  private async saveTransaction(
    queryRunner: QueryRunner,
    data: Partial<TransactionEntity> & { id: string },
  ): Promise<TransactionEntity> {
    const repository = queryRunner.manager.getRepository(TransactionEntity);
    const entity = repository.create(data);
    return repository.save(entity);
  }

  private async saveMovement(
    queryRunner: QueryRunner,
    data: Omit<MovementEntity, 'id' | 'createdAt' | 'transaction' | 'wallet'>,
  ): Promise<MovementEntity> {
    const repository = queryRunner.manager.getRepository(MovementEntity);
    const entity = repository.create({ id: generateId('mov'), ...data });
    return repository.save(entity);
  }

  private async markReversed(
    queryRunner: QueryRunner,
    originalId: string,
    reversalId: string,
  ): Promise<void> {
    await queryRunner.manager.update(
      TransactionEntity,
      { id: originalId },
      { status: TransactionStatus.REVERSED, reversedByTransactionId: reversalId },
    );
  }

  private toTransactionResponse(transaction: TransactionEntity): TransactionResponseDto {
    return {
      transactionId: transaction.id,
      walletId: transaction.walletId,
      targetWalletId: transaction.targetWalletId ?? null,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description ?? null,
      externalReference: transaction.externalReference ?? null,
      reversalOfTransactionId: transaction.reversalOfTransactionId ?? null,
      createdAt: transaction.createdAt.toISOString(),
    };
  }
}
