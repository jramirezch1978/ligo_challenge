import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IdempotencyRecordStatus } from '@app/common/enums/idempotency-status.enum';

/**
 * Persists one row per (idempotencyKey, endpoint) pair so that:
 *  - a repeated request with the same key + same payload replays the stored response.
 *  - a repeated request with the same key + different payload is rejected with 409.
 *  - a concurrent in-flight duplicate is rejected with 409 instead of double-processing.
 */
@Entity('idempotency_keys')
@Index(['idempotencyKey', 'endpoint'], { unique: true })
export class IdempotencyKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 128 })
  endpoint: string;

  @Column({ type: 'varchar', length: 64 })
  requestHash: string;

  @Column({
    type: 'enum',
    enum: IdempotencyRecordStatus,
    default: IdempotencyRecordStatus.PROCESSING,
  })
  status: IdempotencyRecordStatus;

  @Column({ type: 'smallint', nullable: true })
  responseStatus?: number | null;

  @Column({ type: 'jsonb', nullable: true })
  responseBody?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
