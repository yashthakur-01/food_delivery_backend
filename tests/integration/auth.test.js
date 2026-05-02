'use strict';

/**
 * Integration tests for Auth flows.
 * Tests POST /api/auth/* endpoints using supertest.
 */

require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const { createApp } = require('../__helpers__/testApp');
const { cleanDatabase, disconnectPrisma, prisma } = require('../__helpers__/factories');
const redis = require('../../src/config/redis');

let app;
let server;

beforeAll(async () => {
  const instance = createApp();
  app = instance.app;
  server = instance.server;
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectPrisma();
  await redis.quit();
  server.close();
});

afterEach(async () => {
  await cleanDatabase();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function uniquePhone() {
  return `+1${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function uniqueEmail() {
  return `test_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
}

async function registerUser(overrides = {}) {
  const defaults = {
    name: 'Test User',
    phone: uniquePhone(),
    password: 'Password123!',
    role: 'customer',
  };
  return request(app)
    .post('/api/auth/register')
    .send({ ...defaults, ...overrides });
}

async function getOtpFromRedis(identifier) {
  return redis.get(`otp:${identifier}`);
}

// ─── Happy Paths ─────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('201 — creates user with phone', async () => {
    const phone = uniquePhone();
    const res = await registerUser({ phone });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ phone, role: 'customer' });
  });

  it('201 — creates user with email', async () => {
    const email = uniqueEmail();
    const res = await registerUser({ email, phone: undefined });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ email, role: 'customer' });
  });

  it('409 — duplicate phone returns conflict', async () => {
    const phone = uniquePhone();
    await registerUser({ phone });
    const res = await registerUser({ phone });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('409 — duplicate email returns conflict', async () => {
    const email = uniqueEmail();
    await registerUser({ email, phone: undefined });
    const res = await registerUser({ email, phone: undefined });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('422 — missing name returns validation error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ phone: uniquePhone(), password: 'Password123!', role: 'customer' });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('422 — missing both email and phone returns validation error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', password: 'Password123!', role: 'customer' });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('422 — invalid role returns validation error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', phone: uniquePhone(), password: 'Password123!', role: 'admin' });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

// DISABLED - OTP verification is now automatic on registration
// describe('POST /api/auth/verify-otp', () => {
//   it('200 — correct OTP verifies user', async () => {
//     const phone = uniquePhone();
//     await registerUser({ phone });

//     const otp = await getOtpFromRedis(phone);
//     expect(otp).toBeTruthy();

//     const res = await request(app)
//       .post('/api/auth/verify-otp')
//       .send({ identifier: phone, otp });

//     expect(res.status).toBe(200);
//     expect(res.body.success).toBe(true);

//     // Verify user is now verified in DB
//     const user = await prisma.user.findFirst({ where: { phone } });
//     expect(user.is_verified).toBe(true);
//   });

//   it('400 — wrong OTP returns error', async () => {
//     const phone = uniquePhone();
//     await registerUser({ phone });

//     const res = await request(app)
//       .post('/api/auth/verify-otp')
//       .send({ identifier: phone, otp: '000000' });

//     expect(res.status).toBe(400);
//     expect(res.body.success).toBe(false);
//   });

//   it('400 — expired OTP returns error', async () => {
//     const phone = uniquePhone();
//     await registerUser({ phone });

//     // Delete the OTP from Redis to simulate expiry
//     await redis.del(`otp:${phone}`);

//     const res = await request(app)
//       .post('/api/auth/verify-otp')
//       .send({ identifier: phone, otp: '123456' });

//     expect(res.status).toBe(400);
//     expect(res.body.success).toBe(false);
//   });
// });

describe('POST /api/auth/login/password', () => {
  it('200 — returns accessToken and refreshToken', async () => {
    const phone = uniquePhone();
    const password = 'Password123!';
    await registerUser({ phone, password });

    // User is now auto-verified on registration
    // const otp = await getOtpFromRedis(phone);
    // await request(app).post('/api/auth/verify-otp').send({ identifier: phone, otp });

    const res = await request(app)
      .post('/api/auth/login/password')
      .send({ identifier: phone, password, role: 'customer' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
  });

  it('401 — wrong password returns unauthorized', async () => {
    const phone = uniquePhone();
    await registerUser({ phone });
    // User is now auto-verified on registration
    // const otp = await getOtpFromRedis(phone);
    // await request(app).post('/api/auth/verify-otp').send({ identifier: phone, otp });

    const res = await request(app)
      .post('/api/auth/login/password')
      .send({ identifier: phone, password: 'WrongPassword!', role: 'customer' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('403 — role mismatch returns forbidden', async () => {
    const phone = uniquePhone();
    await registerUser({ phone, role: 'customer' });
    // User is now auto-verified on registration
    // const otp = await getOtpFromRedis(phone);
    // await request(app).post('/api/auth/verify-otp').send({ identifier: phone, otp });

    const res = await request(app)
      .post('/api/auth/login/password')
      .send({ identifier: phone, password: 'Password123!', role: 'restaurant_owner' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('403 — unverified user blocked from login', async () => {
    const phone = uniquePhone();
    await registerUser({ phone });
    
    // Manually set user as unverified to test this scenario
    const user = await prisma.user.findFirst({ where: { phone } });
    await prisma.user.update({ where: { id: user.id }, data: { is_verified: false } });

    const res = await request(app)
      .post('/api/auth/login/password')
      .send({ identifier: phone, password: 'Password123!', role: 'customer' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('401 — non-existent user returns unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/login/password')
      .send({ identifier: '+19999999999', password: 'Password123!', role: 'customer' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/login/otp/request', () => {
  it('200 — sends OTP for existing user', async () => {
    const phone = uniquePhone();
    await registerUser({ phone });
    // User is now auto-verified on registration
    // const regOtp = await getOtpFromRedis(phone);
    // await request(app).post('/api/auth/verify-otp').send({ identifier: phone, otp: regOtp });

    const res = await request(app)
      .post('/api/auth/login/otp/request')
      .send({ identifier: phone, role: 'customer' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('403 — role mismatch returns forbidden', async () => {
    const phone = uniquePhone();
    await registerUser({ phone, role: 'customer' });

    const res = await request(app)
      .post('/api/auth/login/otp/request')
      .send({ identifier: phone, role: 'delivery' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('404 — non-existent user returns not found', async () => {
    const res = await request(app)
      .post('/api/auth/login/otp/request')
      .send({ identifier: '+19999999998', role: 'customer' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/login/otp/verify', () => {
  it('200 — correct OTP returns tokens', async () => {
    const phone = uniquePhone();
    await registerUser({ phone });
    // User is now auto-verified on registration
    // const regOtp = await getOtpFromRedis(phone);
    // await request(app).post('/api/auth/verify-otp').send({ identifier: phone, otp: regOtp });

    // Request login OTP
    await request(app)
      .post('/api/auth/login/otp/request')
      .send({ identifier: phone, role: 'customer' });

    const loginOtp = await getOtpFromRedis(phone);

    const res = await request(app)
      .post('/api/auth/login/otp/verify')
      .send({ identifier: phone, otp: loginOtp, role: 'customer' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
  });

  it('400 — wrong OTP returns error', async () => {
    const phone = uniquePhone();
    await registerUser({ phone });
    // User is now auto-verified on registration
    // const regOtp = await getOtpFromRedis(phone);
    // await request(app).post('/api/auth/verify-otp').send({ identifier: phone, otp: regOtp });

    await request(app)
      .post('/api/auth/login/otp/request')
      .send({ identifier: phone, role: 'customer' });

    const res = await request(app)
      .post('/api/auth/login/otp/verify')
      .send({ identifier: phone, otp: '000000', role: 'customer' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/refresh', () => {
  it('200 — valid refreshToken returns new accessToken', async () => {
    const phone = uniquePhone();
    await registerUser({ phone });
    // User is now auto-verified on registration
    // const regOtp = await getOtpFromRedis(phone);
    // await request(app).post('/api/auth/verify-otp').send({ identifier: phone, otp: regOtp });

    const loginRes = await request(app)
      .post('/api/auth/login/password')
      .send({ identifier: phone, password: 'Password123!', role: 'customer' });

    const { refreshToken } = loginRes.body.data;

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('422 — missing refreshToken returns validation error', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/logout', () => {
  it('200 — authenticated user can logout', async () => {
    const phone = uniquePhone();
    await registerUser({ phone });
    // User is now auto-verified on registration
    // const regOtp = await getOtpFromRedis(phone);
    // await request(app).post('/api/auth/verify-otp').send({ identifier: phone, otp: regOtp });

    const loginRes = await request(app)
      .post('/api/auth/login/password')
      .send({ identifier: phone, password: 'Password123!', role: 'customer' });

    const { accessToken } = loginRes.body.data;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('401 — unauthenticated logout returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
