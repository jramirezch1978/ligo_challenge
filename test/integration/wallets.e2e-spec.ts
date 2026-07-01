import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import {
  createTestApp,
  createTestWallet,
  loginAndGetToken,
  newIdempotencyKey,
} from './utils/test-app.util';

describe('Wallets (e2e)', () => {
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

  it('returns the balance for an existing wallet', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '250.75' });

    const response = await request(app.getHttpServer())
      .get(`/api/wallets/${wallet.id}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      walletId: wallet.id,
      currency: 'PEN',
      availableBalance: '250.75',
      status: 'ACTIVE',
    });
  });

  it('returns 404 for a non-existent wallet', async () => {
    await request(app.getHttpServer())
      .get('/api/wallets/wal_does_not_exist/balance')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('lists paginated movements after operations happened on the wallet', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '500.00' });

    await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', newIdempotencyKey())
      .send({
        walletId: wallet.id,
        type: 'DEBIT',
        amount: '25.50',
        currency: 'PEN',
        description: 'Pago QR',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', newIdempotencyKey())
      .send({ walletId: wallet.id, type: 'CREDIT', amount: '10.00', currency: 'PEN' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/api/wallets/${wallet.id}/movements`)
      .query({ type: 'ALL', status: 'COMPLETED', page: 1, pageSize: 20 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.walletId).toBe(wallet.id);
    expect(response.body.total).toBe(2);
    expect(response.body.movements).toHaveLength(2);
    expect(response.body.movements[0]).toEqual(
      expect.objectContaining({
        amount: expect.any(String),
        type: expect.any(String),
        status: 'COMPLETED',
      }),
    );
  });

  it('filters movements by type', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '500.00' });

    await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', newIdempotencyKey())
      .send({ walletId: wallet.id, type: 'CREDIT', amount: '15.00', currency: 'PEN' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/api/wallets/${wallet.id}/movements`)
      .query({ type: 'DEBIT' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.total).toBe(0);
  });
});
