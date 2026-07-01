import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Preloads demo wallets so the API is immediately usable after `docker compose up`,
 * matching the challenge's sample payloads (wal_001, wal_002) plus extra fixtures
 * that exercise the documented edge cases (different currency, blocked wallet).
 */
export class SeedInitialWallets1719800000001 implements MigrationInterface {
  name = 'SeedInitialWallets1719800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "wallets" ("id", "currency", "availableBalance", "status", "ownerName") VALUES
        ('wal_001', 'PEN', 1500.00, 'ACTIVE', 'Juan Perez'),
        ('wal_002', 'PEN', 500.00, 'ACTIVE', 'Maria Lopez'),
        ('wal_003', 'USD', 200.00, 'ACTIVE', 'Carlos Gomez'),
        ('wal_004', 'PEN', 300.00, 'BLOCKED', 'Ana Torres')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "wallets" WHERE "id" IN ('wal_001', 'wal_002', 'wal_003', 'wal_004')`,
    );
  }
}
