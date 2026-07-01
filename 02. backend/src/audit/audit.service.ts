import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AuditLogEntity } from './entities/audit-log.entity';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  performedBy?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  /** Records an audit entry using the caller's transaction so it is committed atomically with the operation. */
  async record(queryRunner: QueryRunner, entry: AuditEntry): Promise<void> {
    const repository = queryRunner.manager.getRepository(AuditLogEntity);
    await repository.insert({
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      performedBy: entry.performedBy ?? null,
      metadata: entry.metadata ?? null,
    } as QueryDeepPartialEntity<AuditLogEntity>);
  }
}
