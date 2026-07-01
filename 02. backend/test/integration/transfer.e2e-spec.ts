import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import {
  createTestApp,
  createTestWallet,
  loginAndGetToken,
  newIdempotencyKey,
} from './utils/test-app.util';
import { WalletStatus } from '@app/common/enums/wallet-status.enum';

describe('Transfers (e2e)', () => {
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

  const transfer = (body: unknown, idempotencyKey?: string) => {
    const req = request(app.getHttpServer())
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${token}`);
    if (idempotencyKey) req.set('Idempotency-Key', idempotencyKey);
    return req.send(body);
  };

  const balanceOf = async (walletId: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .get(`/api/wallets/${walletId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body.availableBalance;
  };

  it('transfers funds between two wallets with a double-entry ledger', async () => {
    const source = await createTestWallet(dataSource, { availableBalance: '200.00' });
    const target = await createTestWallet(dataSource, { availableBalance: '50.00' });

    const response = await transfer(
      { sourceWalletId: source.id, targetWalletId: target.id, amount: '75.00', currency: 'PEN' },
      newIdempotencyKey(),
    ).expect(201);

    expect(response.body.type).toBe('TRANSFER');
    expect(await balanceOf(source.id)).toBe('125.00');
    expect(await balanceOf(target.id)).toBe('125.00');
  });

  it('rejects a transfer with insufficient funds and leaves both balances untouched', async () => {
    const source = await createTestWallet(dataSource, { availableBalance: '10.00' });
    const target = await createTestWallet(dataSource, { availableBalance: '50.00' });

    await transfer(
      { sourceWalletId: source.id, targetWalletId: target.id, amount: '75.00', currency: 'PEN' },
      newIdempotencyKey(),
    ).expect(422);

    expect(await balanceOf(source.id)).toBe('10.00');
    expect(await balanceOf(target.id)).toBe('50.00');
  });

  it('rejects a transfer between wallets with different currencies', async () => {
    const source = await createTestWallet(dataSource, {
      availableBalance: '200.00',
      currency: 'PEN',
    });
    const target = await createTestWallet(dataSource, {
      availableBalance: '50.00',
      currency: 'USD',
    });

    await transfer(
      { sourceWalletId: source.id, targetWalletId: target.id, amount: '10.00', currency: 'PEN' },
      newIdempotencyKey(),
    ).expect(422);
  });

  it('rejects a transfer when the target wallet is blocked', async () => {
    const source = await createTestWallet(dataSource, { availableBalance: '200.00' });
    const target = await createTestWallet(dataSource, {
      availableBalance: '50.00',
      status: WalletStatus.BLOCKED,
    });

    await transfer(
      { sourceWalletId: source.id, targetWalletId: target.id, amount: '10.00', currency: 'PEN' },
      newIdempotencyKey(),
    ).expect(422);
  });

  it('rejects a transfer to the same wallet', async () => {
    const wallet = await createTestWallet(dataSource, { availableBalance: '200.00' });

    await transfer(
      { sourceWalletId: wallet.id, targetWalletId: wallet.id, amount: '10.00', currency: 'PEN' },
      newIdempotencyKey(),
    ).expect(422);
  });

  it('replays the same response for a retried transfer with the same Idempotency-Key', async () => {
    const source = await createTestWallet(dataSource, { availableBalance: '200.00' });
    const target = await createTestWallet(dataSource, { availableBalance: '50.00' });
    const idempotencyKey = newIdempotencyKey();
    const body = {
      sourceWalletId: source.id,
      targetWalletId: target.id,
      amount: '25.00',
      currency: 'PEN',
    };

    const first = await transfer(body, idempotencyKey).expect(201);
    const second = await transfer(body, idempotencyKey).expect(201);

    expect(second.body).toEqual(first.body);
    expect(await balanceOf(source.id)).toBe('175.00');
    expect(await balanceOf(target.id)).toBe('75.00');
  });
});
