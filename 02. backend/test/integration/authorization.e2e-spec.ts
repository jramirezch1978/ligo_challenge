import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import {
  CUSTOMER_OWNER_NAME,
  createTestApp,
  createTestWallet,
  loginAndGetCustomerToken,
  loginAndGetToken,
  newIdempotencyKey,
} from './utils/test-app.util';

describe('Wallet ownership authorization (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    adminToken = await loginAndGetToken(app);
    customerToken = await loginAndGetCustomerToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in as the demo CUSTOMER account and returns a JWT', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'juan.perez', password: 'Cliente123' })
      .expect(200);

    expect(response.body.token).toEqual(expect.any(String));
  });

  it('allows an ADMIN token to list every wallet', async () => {
    await createTestWallet(dataSource, { ownerName: 'Someone Else' });

    const response = await request(app.getHttpServer())
      .get('/api/wallets/list')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.length).toBeGreaterThanOrEqual(2);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          ownerName: expect.any(String),
          currency: expect.any(String),
          status: expect.any(String),
        }),
      ]),
    );
  });

  it('allows a CUSTOMER token to list only wallets they own', async () => {
    const ownedWallet = await createTestWallet(dataSource, { ownerName: CUSTOMER_OWNER_NAME });
    await createTestWallet(dataSource, { ownerName: 'Someone Else' });

    const response = await request(app.getHttpServer())
      .get('/api/wallets/list')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ownedWallet.id,
          ownerName: CUSTOMER_OWNER_NAME,
        }),
      ]),
    );
    expect(response.body.every((wallet: { ownerName: string }) => wallet.ownerName === CUSTOMER_OWNER_NAME)).toBe(
      true,
    );
  });

  it('allows an ADMIN token to read the balance of any wallet', async () => {
    const wallet = await createTestWallet(dataSource, { ownerName: 'Someone Else' });

    await request(app.getHttpServer())
      .get('/api/wallets/balance')
      .query({ walletId: wallet.id })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('allows a CUSTOMER token to read the balance of a wallet they own', async () => {
    const wallet = await createTestWallet(dataSource, { ownerName: CUSTOMER_OWNER_NAME });

    await request(app.getHttpServer())
      .get('/api/wallets/balance')
      .query({ walletId: wallet.id })
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
  });

  it('rejects a CUSTOMER token reading the balance of a wallet owned by someone else with 403', async () => {
    const wallet = await createTestWallet(dataSource, { ownerName: 'Someone Else' });

    await request(app.getHttpServer())
      .get('/api/wallets/balance')
      .query({ walletId: wallet.id })
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('rejects a CUSTOMER token listing movements of a wallet owned by someone else with 403', async () => {
    const wallet = await createTestWallet(dataSource, { ownerName: 'Someone Else' });

    await request(app.getHttpServer())
      .get('/api/wallets/movements')
      .query({ walletId: wallet.id })
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('rejects a CUSTOMER token debiting a wallet owned by someone else with 403', async () => {
    const wallet = await createTestWallet(dataSource, {
      ownerName: 'Someone Else',
      availableBalance: '500.00',
    });

    await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', newIdempotencyKey())
      .send({ walletId: wallet.id, type: 'DEBIT', amount: '10.00', currency: 'PEN' })
      .expect(403);
  });

  it('allows a CUSTOMER token to debit a wallet they own', async () => {
    const wallet = await createTestWallet(dataSource, {
      ownerName: CUSTOMER_OWNER_NAME,
      availableBalance: '500.00',
    });

    await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', newIdempotencyKey())
      .send({ walletId: wallet.id, type: 'DEBIT', amount: '10.00', currency: 'PEN' })
      .expect(201);
  });

  it('rejects a CUSTOMER token transferring out of a wallet owned by someone else with 403', async () => {
    const source = await createTestWallet(dataSource, {
      ownerName: 'Someone Else',
      availableBalance: '500.00',
    });
    const target = await createTestWallet(dataSource, { ownerName: CUSTOMER_OWNER_NAME });

    await request(app.getHttpServer())
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', newIdempotencyKey())
      .send({
        sourceWalletId: source.id,
        targetWalletId: target.id,
        amount: '10.00',
        currency: 'PEN',
      })
      .expect(403);
  });

  it('allows a CUSTOMER token to transfer funds to a wallet owned by someone else', async () => {
    const source = await createTestWallet(dataSource, {
      ownerName: CUSTOMER_OWNER_NAME,
      availableBalance: '500.00',
    });
    const target = await createTestWallet(dataSource, { ownerName: 'Someone Else' });

    await request(app.getHttpServer())
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', newIdempotencyKey())
      .send({
        sourceWalletId: source.id,
        targetWalletId: target.id,
        amount: '10.00',
        currency: 'PEN',
      })
      .expect(201);
  });

  it('rejects a CUSTOMER token reversing a transaction on a wallet owned by someone else with 403', async () => {
    const wallet = await createTestWallet(dataSource, {
      ownerName: 'Someone Else',
      availableBalance: '500.00',
    });

    const created = await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', newIdempotencyKey())
      .send({ walletId: wallet.id, type: 'DEBIT', amount: '10.00', currency: 'PEN' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/transactions/reversal')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', newIdempotencyKey())
      .send({ transactionId: created.body.transactionId, reason: 'not mine' })
      .expect(403);
  });
});
