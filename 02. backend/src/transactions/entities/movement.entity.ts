import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { MovementType } from '@app/common/enums/movement-type.enum';
import { DecimalTransformer } from '@app/common/utils/decimal.transformer';
import { TransactionEntity } from './transaction.entity';
import { WalletEntity } from '@app/wallets/entities/wallet.entity';

/**
 * Ledger entry: every balance-affecting event on a wallet produces exactly one
 * Movement row. A transfer produces two movements (DEBIT on source, CREDIT on
 * target) sharing the same `transactionId`, implementing double-entry bookkeeping.
 */
@Entity('movements')
export class MovementEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  transactionId: string;

  @ManyToOne(() => TransactionEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'transactionId' })
  transaction?: TransactionEntity;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  walletId: string;

  @ManyToOne(() => WalletEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'walletId' })
  wallet?: WalletEntity;

  @Column({ type: 'enum', enum: MovementType })
  type: MovementType;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    transformer: new DecimalTransformer(),
  })
  amount: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    transformer: new DecimalTransformer(),
  })
  balanceAfter: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
