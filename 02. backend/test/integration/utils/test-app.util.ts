import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '@app/app.module';
import { WalletEntity } from '@app/wallets/entities/wallet.entity';
import { WalletStatus } from '@app/common/enums/wallet-status.enum';

export interface TestContext {
  app: INestApplication;
  dataSource: DataSource;
  token: string;
}

export async function createTestApp(): Promise<{ app: INestApplication; dataSource: DataSource }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] });
  await app.init();

  const dataSource = app.get(DataSource);
  return { app, dataSource };
}

/** Logs in as the ADMIN demo account (unrestricted access to every wallet). */
export async function loginAndGetToken(app: INestApplication): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ username: 'senior.backend', password: 'Password123' });
  return response.body.token;
}

/** Logs in as the CUSTOMER demo account, scoped to the "Juan Perez" wallet owner. */
export async function loginAndGetCustomerToken(app: INestApplication): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ username: 'juan.perez', password: 'Cliente123' });
  return response.body.token;
}

export const CUSTOMER_OWNER_NAME = 'Juan Perez';

let sequence = 0;

/** Creates an isolated wallet fixture directly in the DB, bypassing the API (no wallet-creation endpoint exists). */
export async function createTestWallet(
  dataSource: DataSource,
  overrides: Partial<
    Pick<WalletEntity, 'currency' | 'availableBalance' | 'status' | 'ownerName'>
  > = {},
): Promise<WalletEntity> {
  sequence += 1;
  const repository = dataSource.getRepository(WalletEntity);
  const wallet = repository.create({
    id: `wal_test_${Date.now()}_${sequence}`,
    currency: overrides.currency ?? 'PEN',
    availableBalance: overrides.availableBalance ?? '1000.00',
    status: overrides.status ?? WalletStatus.ACTIVE,
    ownerName: overrides.ownerName ?? null,
  });
  return repository.save(wallet);
}

export function newIdempotencyKey(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
