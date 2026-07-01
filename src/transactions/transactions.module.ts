import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionEntity } from './entities/transaction.entity';
import { MovementEntity } from './entities/movement.entity';
import { WalletEntity } from '@app/wallets/entities/wallet.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { IdempotencyModule } from '@app/idempotency/idempotency.module';
import { AuditModule } from '@app/audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionEntity, MovementEntity, WalletEntity]),
    IdempotencyModule,
    AuditModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
