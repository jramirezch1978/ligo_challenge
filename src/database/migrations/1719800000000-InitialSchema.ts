import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1719800000000 implements MigrationInterface {
  name = 'InitialSchema1719800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(
      `CREATE TYPE "wallet_status_enum" AS ENUM ('ACTIVE', 'BLOCKED', 'CLOSED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "transaction_type_enum" AS ENUM ('DEBIT', 'CREDIT', 'TRANSFER', 'REVERSAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "transaction_status_enum" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED')`,
    );
    await queryRunner.query(`CREATE TYPE "movement_type_enum" AS ENUM ('DEBIT', 'CREDIT')`);
    await queryRunner.query(
      `CREATE TYPE "idempotency_keys_status_enum" AS ENUM ('PROCESSING', 'COMPLETED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id" varchar(64) PRIMARY KEY,
        "currency" varchar(3) NOT NULL,
        "availableBalance" numeric(18,2) NOT NULL DEFAULT 0,
        "status" "wallet_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "ownerName" varchar(128),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" varchar(64) PRIMARY KEY,
        "type" "transaction_type_enum" NOT NULL,
        "status" "transaction_status_enum" NOT NULL DEFAULT 'PENDING',
        "walletId" varchar(64) NOT NULL REFERENCES "wallets"("id"),
        "targetWalletId" varchar(64) REFERENCES "wallets"("id"),
        "amount" numeric(18,2) NOT NULL,
        "currency" varchar(3) NOT NULL,
        "description" varchar(255),
        "externalReference" varchar(128),
        "idempotencyKey" varchar(128),
        "reversalOfTransactionId" varchar(64),
        "reversedByTransactionId" varchar(64),
        "failureReason" varchar(255),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_walletId" ON "transactions" ("walletId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_targetWalletId" ON "transactions" ("targetWalletId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_externalReference" ON "transactions" ("externalReference")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_reversalOfTransactionId" ON "transactions" ("reversalOfTransactionId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "movements" (
        "id" varchar(64) PRIMARY KEY,
        "transactionId" varchar(64) NOT NULL REFERENCES "transactions"("id"),
        "walletId" varchar(64) NOT NULL REFERENCES "wallets"("id"),
        "type" "movement_type_enum" NOT NULL,
        "amount" numeric(18,2) NOT NULL,
        "balanceAfter" numeric(18,2) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_movements_transactionId" ON "movements" ("transactionId")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_movements_walletId" ON "movements" ("walletId")`);

    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idempotencyKey" varchar(128) NOT NULL,
        "endpoint" varchar(128) NOT NULL,
        "requestHash" varchar(64) NOT NULL,
        "status" "idempotency_keys_status_enum" NOT NULL DEFAULT 'PROCESSING',
        "responseStatus" smallint,
        "responseBody" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_idempotency_keys_key_endpoint" ON "idempotency_keys" ("idempotencyKey", "endpoint")`,
    );

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "action" varchar(64) NOT NULL,
        "entityType" varchar(64) NOT NULL,
        "entityId" varchar(64) NOT NULL,
        "performedBy" varchar(128),
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entityId" ON "audit_logs" ("entityId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "movements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "idempotency_keys_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "movement_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transaction_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transaction_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "wallet_status_enum"`);
  }
}
