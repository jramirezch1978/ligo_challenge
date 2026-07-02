import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import {
  createTestApp,
  createTestWallet,
  loginAndGetToken,
  newIdempotencyKey,
} from './utils/test-app.util';
import { WalletStatus } from '@app/common/enums/wallet-status.enum';
import { AuditLogEntity } from '@app/audit/entities/audit-log.entity';

describe('Transactions (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    token = await loginAndGetToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (body: object, idempotencyKey?: string) => {
    const req = request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`);
    if (idempotencyKey) {
      req.set('Idempotency-Key', idempotencyKey);
    }
    return req.send(body);
  };

  it('processes a successful debit and updates the balance atomically', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '100.00' });

    const response = await post(
      {
        walletId: wallet.id,
        type: 'DEBIT',
        amount: '30.00',
        currency: 'PEN',
        externalReference: 'qr_1',
      },
      newIdempotencyKey(),
    ).expect(201);

    expect(response.body.status).toBe('COMPLETED');
    expect(response.body.type).toBe('DEBIT');

    const balance = await request(app.getHttpServer())
      .get('/api/wallets/balance')
      .query({ walletId: wallet.id })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(balance.body.availableBalance).toBe('70.00');
  });

  it('processes a successful credit and updates the balance atomically', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '100.00' });

    await post(
      { walletId: wallet.id, type: 'CREDIT', amount: '50.00', currency: 'PEN' },
      newIdempotencyKey(),
    ).expect(201);

    const balance = await request(app.getHttpServer())
      .get('/api/wallets/balance')
      .query({ walletId: wallet.id })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(balance.body.availableBalance).toBe('150.00');
  });

  it('rejects a debit with insufficient funds (422) and leaves balance untouched', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '10.00' });

    await post(
      { walletId: wallet.id, type: 'DEBIT', amount: '50.00', currency: 'PEN' },
      newIdempotencyKey(),
    ).expect(422);

    const balance = await request(app.getHttpServer())
      .get('/api/wallets/balance')
      .query({ walletId: wallet.id })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(balance.body.availableBalance).toBe('10.00');
  });

  it('rejects operations on a blocked wallet with 422', async () => {
    const wallet = await createTestWallet(dataSource, {
      availableBalance: '100.00',
      status: WalletStatus.BLOCKED,
    });

    await post(
      { walletId: wallet.id, type: 'DEBIT', amount: '10.00', currency: 'PEN' },
      newIdempotencyKey(),
    ).expect(422);
  });

  it('returns 404 for a non-existent wallet', async () => {
    await post(
      { walletId: 'wal_missing', type: 'DEBIT', amount: '10.00', currency: 'PEN' },
      newIdempotencyKey(),
    ).expect(404);
  });

  it('returns 422 when the currency does not match the wallet currency', async () => {
    const wallet = await createTestWallet(dataSource, {
      currency: 'PEN',
      availableBalance: '100.00',
    });

    await post(
      { walletId: wallet.id, type: 'DEBIT', amount: '10.00', currency: 'USD' },
      newIdempotencyKey(),
    ).expect(422);
  });

  it('returns 400 when the Idempotency-Key header is missing', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '100.00' });
    await post({ walletId: wallet.id, type: 'DEBIT', amount: '10.00', currency: 'PEN' }).expect(
      400,
    );
  });

  it('returns 400 for an invalid money amount format', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '100.00' });
    await post(
      { walletId: wallet.id, type: 'DEBIT', amount: '10.999', currency: 'PEN' },
      newIdempotencyKey(),
    ).expect(400);
  });

  it('replays the exact same response when the same Idempotency-Key is retried with the same payload', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '100.00' });
    const idempotencyKey = newIdempotencyKey();
    const body = { walletId: wallet.id, type: 'DEBIT', amount: '20.00', currency: 'PEN' };

    const first = await post(body, idempotencyKey).expect(201);
    const second = await post(body, idempotencyKey).expect(201);

    expect(second.body).toEqual(first.body);

    const balance = await request(app.getHttpServer())
      .get('/api/wallets/balance')
      .query({ walletId: wallet.id })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    // Balance must reflect a SINGLE debit, proving the retry was not reprocessed.
    expect(balance.body.availableBalance).toBe('80.00');
  });

  it('returns 409 when the same Idempotency-Key is reused with a different payload', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '100.00' });
    const idempotencyKey = newIdempotencyKey();

    await post(
      { walletId: wallet.id, type: 'DEBIT', amount: '20.00', currency: 'PEN' },
      idempotencyKey,
    ).expect(201);
    await post(
      { walletId: wallet.id, type: 'DEBIT', amount: '99.00', currency: 'PEN' },
      idempotencyKey,
    ).expect(409);
  });

  it('allows querying the status of a created transaction', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '100.00' });
    const created = await post(
      {
        walletId: wallet.id,
        type: 'DEBIT',
        amount: '5.00',
        currency: 'PEN',
        externalReference: 'ref_status',
      },
      newIdempotencyKey(),
    ).expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/transactions/status')
      .query({ transactionId: created.body.transactionId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      transactionId: created.body.transactionId,
      status: 'COMPLETED',
      externalReference: 'ref_status',
    });
  });

  it('returns 404 when querying the status of an unknown transaction', async () => {
    await request(app.getHttpServer())
      .get('/api/transactions/status')
      .query({ transactionId: 'txn_does_not_exist' })
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('leaves an audit trail entry for every critical (balance-affecting) operation', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '100.00' });

    const created = await post(
      { walletId: wallet.id, type: 'DEBIT', amount: '15.00', currency: 'PEN' },
      newIdempotencyKey(),
    ).expect(201);

    const auditRepository = dataSource.getRepository(AuditLogEntity);
    const entries = await auditRepository.find({
      where: { entityId: created.body.transactionId, entityType: 'Transaction' },
    });

    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0]).toMatchObject({
      action: 'TRANSACTION_DEBIT_CREATED',
      entityType: 'Transaction',
      entityId: created.body.transactionId,
      performedBy: 'senior.backend',
    });
    expect(entries[0].metadata).toMatchObject({ walletId: wallet.id, amount: '15.00' });
  });
});
