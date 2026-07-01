import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TransactionType } from '@app/common/enums/transaction-type.enum';
import { TransactionStatus } from '@app/common/enums/transaction-status.enum';
import { DecimalTransformer } from '@app/common/utils/decimal.transformer';
import { WalletEntity } from '@app/wallets/entities/wallet.entity';

@Entity('transactions')
export class TransactionEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  walletId: string;

  @ManyToOne(() => WalletEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'walletId' })
  wallet?: WalletEntity;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  targetWalletId?: string | null;

  @ManyToOne(() => WalletEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'targetWalletId' })
  targetWallet?: WalletEntity | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    transformer: new DecimalTransformer(),
  })
  amount: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true })
  externalReference?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  idempotencyKey?: string | null;

  /** Set on a REVERSAL transaction, pointing back to the transaction it reverses. */
  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  reversalOfTransactionId?: string | null;

  /** Set on the original transaction once it has been reversed (guards against double reversal). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  reversedByTransactionId?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  failureReason?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
