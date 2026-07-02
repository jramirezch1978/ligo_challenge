import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import {
  createTestApp,
  createTestWallet,
  loginAndGetToken,
  newIdempotencyKey,
} from './utils/test-app.util';

describe('Reversals (e2e)', () => {
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

  const createDebit = async (walletId: string, amount: string) => {
    const response = await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', newIdempotencyKey())
      .send({ walletId, type: 'DEBIT', amount, currency: 'PEN' })
      .expect(201);
    return response.body.transactionId as string;
  };

  const reverse = (transactionId: string, body: Record<string, unknown>, idempotencyKey?: string) => {
    const req = request(app.getHttpServer())
      .post('/api/transactions/reversal')
      .set('Authorization', `Bearer ${token}`);
    if (idempotencyKey) req.set('Idempotency-Key', idempotencyKey);
    return req.send({ transactionId, ...body });
  };

  const balanceOf = async (walletId: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .get('/api/wallets/balance')
      .query({ walletId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body.availableBalance;
  };

  it('reverses a debit transaction, restoring the original balance', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '100.00' });
    const transactionId = await createDebit(wallet.id, '40.00');
    expect(await balanceOf(wallet.id)).toBe('60.00');

    const response = await reverse(
      transactionId,
      { reason: 'Merchant refund' },
      newIdempotencyKey(),
    ).expect(201);

    expect(response.body.type).toBe('REVERSAL');
    expect(await balanceOf(wallet.id)).toBe('100.00');
  });

  it('reverses a transfer, restoring both original balances', async () => {
    const source = await createTestWallet(dataSource, { availableBalance: '200.00' });
    const target = await createTestWallet(dataSource, { availableBalance: '50.00' });

    const transferResponse = await request(app.getHttpServer())
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', newIdempotencyKey())
      .send({
        sourceWalletId: source.id,
        targetWalletId: target.id,
        amount: '60.00',
        currency: 'PEN',
      })
      .expect(201);

    expect(await balanceOf(source.id)).toBe('140.00');
    expect(await balanceOf(target.id)).toBe('110.00');

    await reverse(
      transferResponse.body.transactionId,
      { reason: 'Reversal test' },
      newIdempotencyKey(),
    ).expect(201);

    expect(await balanceOf(source.id)).toBe('200.00');
    expect(await balanceOf(target.id)).toBe('50.00');
  });

  it('rejects reversing the same transaction twice with 409', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '100.00' });
    const transactionId = await createDebit(wallet.id, '10.00');

    await reverse(transactionId, { reason: 'first reversal' }, newIdempotencyKey()).expect(201);
    await reverse(transactionId, { reason: 'second reversal attempt' }, newIdempotencyKey()).expect(
      409,
    );
  });

  it('returns 404 when reversing a non-existent transaction', async () => {
    await reverse('txn_does_not_exist', { reason: 'n/a' }, newIdempotencyKey()).expect(404);
  });

  it('returns 422 when trying to reverse a reversal itself', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '100.00' });
    const transactionId = await createDebit(wallet.id, '10.00');

    const reversal = await reverse(
      transactionId,
      { reason: 'first reversal' },
      newIdempotencyKey(),
    ).expect(201);
    await reverse(
      reversal.body.transactionId,
      { reason: 'reverse a reversal' },
      newIdempotencyKey(),
    ).expect(422);
  });

  it('replays the same response for a retried reversal with the same Idempotency-Key', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '100.00' });
    const transactionId = await createDebit(wallet.id, '10.00');
    const idempotencyKey = newIdempotencyKey();

    const first = await reverse(transactionId, { reason: 'refund' }, idempotencyKey).expect(201);
    const second = await reverse(transactionId, { reason: 'refund' }, idempotencyKey).expect(201);

    expect(second.body).toEqual(first.body);
  });
});
