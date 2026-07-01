-- ============================================================================
-- Wallet Transaction Service - Esquema de base de datos (PostgreSQL 17)
-- Ligo - Backend Senior Technical Challenge
--
-- Este script recrea el esquema completo usado por el microservicio backend:
-- wallets, transactions, movements (ledger de doble entrada), idempotency_keys
-- y audit_logs. Se ejecuta automaticamente al iniciar el contenedor de
-- PostgreSQL (docker-entrypoint-initdb.d) o puede aplicarse manualmente con:
--   psql -U <user> -d <database> -f 001_schema.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tipos ENUM
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE wallet_status_enum AS ENUM ('ACTIVE', 'BLOCKED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type_enum AS ENUM ('DEBIT', 'CREDIT', 'TRANSFER', 'REVERSAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status_enum AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE movement_type_enum AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE idempotency_keys_status_enum AS ENUM ('PROCESSING', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- wallets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallets (
  id               varchar(64) PRIMARY KEY,
  "currency"       varchar(3) NOT NULL,
  "availableBalance" numeric(18,2) NOT NULL DEFAULT 0,
  status           wallet_status_enum NOT NULL DEFAULT 'ACTIVE',
  "ownerName"      varchar(128),
  "createdAt"      timestamptz NOT NULL DEFAULT now(),
  "updatedAt"      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id                        varchar(64) PRIMARY KEY,
  "type"                    transaction_type_enum NOT NULL,
  status                    transaction_status_enum NOT NULL DEFAULT 'PENDING',
  "walletId"                varchar(64) NOT NULL REFERENCES wallets(id),
  "targetWalletId"          varchar(64) REFERENCES wallets(id),
  amount                    numeric(18,2) NOT NULL,
  "currency"                varchar(3) NOT NULL,
  description               varchar(255),
  "externalReference"       varchar(128),
  "idempotencyKey"          varchar(128),
  "reversalOfTransactionId" varchar(64),
  "reversedByTransactionId" varchar(64),
  "failureReason"           varchar(255),
  "createdAt"               timestamptz NOT NULL DEFAULT now(),
  "updatedAt"               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_transactions_walletId" ON transactions ("walletId");
CREATE INDEX IF NOT EXISTS "IDX_transactions_targetWalletId" ON transactions ("targetWalletId");
CREATE INDEX IF NOT EXISTS "IDX_transactions_externalReference" ON transactions ("externalReference");
CREATE INDEX IF NOT EXISTS "IDX_transactions_reversalOfTransactionId" ON transactions ("reversalOfTransactionId");

-- ---------------------------------------------------------------------------
-- movements (ledger de doble entrada)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movements (
  id              varchar(64) PRIMARY KEY,
  "transactionId" varchar(64) NOT NULL REFERENCES transactions(id),
  "walletId"      varchar(64) NOT NULL REFERENCES wallets(id),
  "type"          movement_type_enum NOT NULL,
  amount          numeric(18,2) NOT NULL,
  "balanceAfter"  numeric(18,2) NOT NULL,
  "createdAt"     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_movements_transactionId" ON movements ("transactionId");
CREATE INDEX IF NOT EXISTS "IDX_movements_walletId" ON movements ("walletId");

-- ---------------------------------------------------------------------------
-- idempotency_keys
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idempotencyKey" varchar(128) NOT NULL,
  endpoint       varchar(128) NOT NULL,
  "requestHash"  varchar(64) NOT NULL,
  status         idempotency_keys_status_enum NOT NULL DEFAULT 'PROCESSING',
  "responseStatus" smallint,
  "responseBody" jsonb,
  "createdAt"    timestamptz NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_idempotency_keys_key_endpoint"
  ON idempotency_keys ("idempotencyKey", endpoint);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action       varchar(64) NOT NULL,
  "entityType" varchar(64) NOT NULL,
  "entityId"   varchar(64) NOT NULL,
  "performedBy" varchar(128),
  metadata     jsonb,
  "createdAt"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action" ON audit_logs (action);
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entityId" ON audit_logs ("entityId");

-- ---------------------------------------------------------------------------
-- Tabla de control de migraciones de TypeORM (backend). Se deja pre-poblada
-- para que, si el backend llega a ejecutar `npm run migration:run` contra esta
-- misma base de datos, reconozca el esquema como ya aplicado y no reintente
-- crearlo (evita conflictos entre el despliegue por SQL y el ORM).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS migrations (
  id        SERIAL PRIMARY KEY,
  "timestamp" bigint NOT NULL,
  name      varchar NOT NULL
);

INSERT INTO migrations ("timestamp", name)
SELECT 1719800000000, 'InitialSchema1719800000000'
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE name = 'InitialSchema1719800000000');

INSERT INTO migrations ("timestamp", name)
SELECT 1719800000001, 'SeedInitialWallets1719800000001'
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE name = 'SeedInitialWallets1719800000001');
