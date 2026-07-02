import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app.util';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in with valid mock credentials and returns a JWT', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'senior.backend', password: 'Password123' })
      .expect(200);

    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.expiresIn).toBe(3600);
  });

  it('rejects invalid credentials with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'senior.backend', password: 'wrong-password' })
      .expect(401);
  });

  it('rejects malformed payloads with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'senior.backend' })
      .expect(400);
  });

  it('rejects unauthenticated access to protected routes with 401', async () => {
    await request(app.getHttpServer())
      .get('/api/wallets/balance')
      .query({ walletId: 'wal_001' })
      .expect(401);
  });
});
