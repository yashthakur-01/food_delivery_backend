'use strict';
/**
 * Property-Based Tests (PBT) — Food Delivery Backend
 * Uses fast-check for property generation.
 *
 * **Validates: Requirements 1–13**
 */
require('dotenv').config({ path: '.env.test' });

const fc = require('fast-check');
const request = require('supertest');
const { createApp } = require('../__helpers__/testApp');
const {
  cleanDatabase,
  disconnectPrisma,
  prisma,
  createTestUser,
  createTestRestaurant,
  createTestMenuItem,
  createTestOrder,
  createTestPayment,
} = require('../__helpers__/factories');
const { signAccessToken, verifyToken } = require('../../src/common/utils/jwt');
const redis = require('../../src/config/redis');

let app, server, io;

beforeAll(async () => {
  const instance = createApp();
  app = instance.app;
  server = instance.server;
  io = instance.io;
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectPrisma();
  if (redis.status !== 'end') await redis.quit();
  server.close();
});

afterEach(async () => {
  await cleanDatabase();
  // Flush rate-limit keys between tests
  const keys = await redis.keys('rate:*');
  if (keys.length) await redis.del(...keys);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _phoneCounter = 1;
function uniquePhone() {
  return `+1555${String(Date.now()).slice(-6)}${String(_phoneCounter++).padStart(3, '0')}`;
}

function uniqueEmail() {
  return `pbt_${Date.now()}_${_phoneCounter++}@example.com`;
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function registerAndVerify(phone, password = 'Password123!', role = 'customer') {
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'PBT User', phone, password, role });
  if (regRes.status !== 201) throw new Error(`Register failed: ${JSON.stringify(regRes.body)}`);
  // User is now auto-verified on registration
  // const otp = await redis.get(`otp:${phone}`);
  // await request(app).post('/api/auth/verify-otp').send({ identifier: phone, otp });
  return regRes.body.data;
}

async function loginAndGetTokens(phone, password = 'Password123!', role = 'customer') {
  const loginRes = await request(app)
    .post('/api/auth/login/password')
    .send({ identifier: phone, password, role });
  if (loginRes.status !== 200) throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  return loginRes.body.data;
}

// ─── Property 1: Registration always creates is_verified=true, status=active ─
// **Validates: Requirements 1.1** (Updated: users are now auto-verified)
describe('Property 1: Registration always creates is_verified=true, status=active', () => {
  it('holds for any valid role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('customer', 'restaurant_owner', 'delivery'),
        async (role) => {
          const phone = uniquePhone();
          const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Test User', phone, password: 'Password123!', role });
          expect(res.status).toBe(201);
          // Verify in DB - users are now auto-verified
          const user = await prisma.user.findFirst({ where: { phone } });
          expect(user.is_verified).toBe(true);
          expect(user.status).toBe('active');
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 2: Duplicate email or phone always returns 409 ──────────────────
// **Validates: Requirements 1.2**
describe('Property 2: Duplicate email or phone always returns 409', () => {
  it('holds for duplicate phone', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const phone = uniquePhone();
          await request(app)
            .post('/api/auth/register')
            .send({ name: 'First', phone, password: 'Password123!', role: 'customer' });
          const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Second', phone, password: 'Password123!', role: 'customer' });
          expect(res.status).toBe(409);
          expect(res.body.success).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('holds for duplicate email', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const email = uniqueEmail();
          await request(app)
            .post('/api/auth/register')
            .send({ name: 'First', email, password: 'Password123!', role: 'customer' });
          const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Second', email, password: 'Password123!', role: 'customer' });
          expect(res.status).toBe(409);
          expect(res.body.success).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 3: OTP round-trip ───────────────────────────────────────────────
// **Validates: Requirements 1.3, 1.4, 1.5**
// DISABLED - Users are now auto-verified on registration
// describe('Property 3: OTP round-trip — register stores OTP, verify-otp marks verified', () => {
//   it('holds for phone-based registration', async () => {
//     await fc.assert(
//       fc.asyncProperty(
//         fc.constant(null),
//         async () => {
//           const phone = uniquePhone();
//           await request(app)
//             .post('/api/auth/register')
//             .send({ name: 'OTP User', phone, password: 'Password123!', role: 'customer' });

//           // OTP must be stored in Redis as a 6-digit string
//           const otp = await redis.get(`otp:${phone}`);
//           expect(otp).toBeTruthy();
//           expect(otp).toMatch(/^\d{6}$/);

//           // Verify with the correct OTP
//           const verifyRes = await request(app)
//             .post('/api/auth/verify-otp')
//             .send({ identifier: phone, otp });
//           expect(verifyRes.status).toBe(200);

//           // User must now be verified in DB
//           const user = await prisma.user.findFirst({ where: { phone } });
//           expect(user.is_verified).toBe(true);

//           // OTP must be consumed (deleted from Redis) after successful verification
//           const otpAfter = await redis.get(`otp:${phone}`);
//           expect(otpAfter).toBeNull();
//         }
//       ),
//       { numRuns: 5 }
//     );
//   });

//   it('holds for email-based registration', async () => {
//     await fc.assert(
//       fc.asyncProperty(
//         fc.constant(null),
//         async () => {
//           const email = uniqueEmail();
//           await request(app)
//             .post('/api/auth/register')
//             .send({ name: 'OTP Email User', email, password: 'Password123!', role: 'customer' });

//           // OTP must be stored in Redis keyed by email
//           const otp = await redis.get(`otp:${email}`);
//           expect(otp).toBeTruthy();
//           expect(otp).toMatch(/^\d{6}$/);

//           // Verify with the correct OTP
//           const verifyRes = await request(app)
//             .post('/api/auth/verify-otp')
//             .send({ identifier: email, otp });
//           expect(verifyRes.status).toBe(200);

//           // User must now be verified in DB
//           const user = await prisma.user.findFirst({ where: { email } });
//           expect(user.is_verified).toBe(true);

//           // OTP must be consumed after use
//           const otpAfter = await redis.get(`otp:${email}`);
//           expect(otpAfter).toBeNull();
//         }
//       ),
//       { numRuns: 5 }
//     );
//   });

//   it('invalid OTP always returns 400 (Requirement 1.5)', async () => {
//     await fc.assert(
//       fc.asyncProperty(
//         // Generate a wrong OTP that is a 6-digit string but different from the real one
//         fc.integer({ min: 100000, max: 999999 }),
//         async (wrongOtpNum) => {
//           const phone = uniquePhone();
//           await request(app)
//             .post('/api/auth/register')
//             .send({ name: 'OTP User', phone, password: 'Password123!', role: 'customer' });

//           const realOtp = await redis.get(`otp:${phone}`);
//           const wrongOtp = String(wrongOtpNum === Number(realOtp)
//             ? (wrongOtpNum === 999999 ? 100000 : wrongOtpNum + 1)
//             : wrongOtpNum);

//           const res = await request(app)
//             .post('/api/auth/verify-otp')
//             .send({ identifier: phone, otp: wrongOtp });
//           expect(res.status).toBe(400);
//           expect(res.body.success).toBe(false);

//           // User must remain unverified
//           const user = await prisma.user.findFirst({ where: { phone } });
//           expect(user.is_verified).toBe(false);
//         }
//       ),
//       { numRuns: 5 }
//     );
//   });

//   it('OTP for non-existent identifier always returns 400', async () => {
//     await fc.assert(
//       fc.asyncProperty(
//         fc.constant(null),
//         async () => {
//           const phone = uniquePhone();
//           // Never registered — no OTP in Redis
//           const res = await request(app)
//             .post('/api/auth/verify-otp')
//             .send({ identifier: phone, otp: '123456' });
//           expect(res.status).toBe(400);
//           expect(res.body.success).toBe(false);
//         }
//       ),
//       { numRuns: 5 }
//     );
//   });
// });

// ─── Property 4: Unverified user always blocked ───────────────────────────────
// **Validates: Requirements 1.6, 2.5**
describe('Property 4: Unverified user always blocked from login', () => {
  it('holds for any role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('customer', 'restaurant_owner', 'delivery'),
        async (role) => {
          const phone = uniquePhone();
          // Register but do NOT verify
          await request(app)
            .post('/api/auth/register')
            .send({ name: 'Unverified', phone, password: 'Password123!', role });

          const res = await request(app)
            .post('/api/auth/login/password')
            .send({ identifier: phone, password: 'Password123!', role });
          expect(res.status).toBe(403);
          expect(res.body.success).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });

  // **Validates: Requirements 1.6, 12.10**
  it('unverified user JWT is blocked on all protected endpoints with 403', async () => {
    const protectedEndpoints = [
      { method: 'get',  path: '/api/users/me',       body: null },
      { method: 'get',  path: '/api/orders',          body: null },
      { method: 'get',  path: '/api/restaurants',     body: null },
      { method: 'get',  path: '/api/notifications',   body: null },
      { method: 'get',  path: '/api/cart',            body: null },
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          role:     fc.constantFrom('customer', 'restaurant_owner', 'delivery'),
          endpoint: fc.constantFrom(...protectedEndpoints),
        }),
        async ({ role, endpoint }) => {
          // Create an unverified user directly in the DB (bypassing login which is already blocked)
          const unverifiedUser = await prisma.user.create({
            data: {
              name:        'Unverified PBT',
              phone:       uniquePhone(),
              password:    'hashed-does-not-matter',
              role,
              is_verified: false,
              status:      'active',
            },
          });

          // Mint a valid JWT for the unverified user
          const token = signAccessToken({
            id:    unverifiedUser.id,
            phone: unverifiedUser.phone,
            role:  unverifiedUser.role,
          });

          // Attempt to access the protected endpoint
          let req = request(app)[endpoint.method](endpoint.path).set(authHeader(token));
          if (endpoint.body) req = req.send(endpoint.body);
          const res = await req;

          // The system MUST reject unverified users with 403 on every protected endpoint
          expect(res.status).toBe(403);
          expect(res.body.success).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });
});

// ─── Property 5: Login JWT always contains correct claims ─────────────────────
// **Validates: Requirements 2.5**
describe('Property 5: Login JWT always contains correct claims', () => {
  it('holds for any role — phone-based login', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('customer', 'restaurant_owner', 'delivery'),
        async (role) => {
          const phone = uniquePhone();
          await registerAndVerify(phone, 'Password123!', role);
          const { accessToken } = await loginAndGetTokens(phone, 'Password123!', role);

          const decoded = verifyToken(accessToken);

          // Requirement 2.5: JWT payload must include id, phone, email, role, is_verified
          expect(decoded).toHaveProperty('id');
          expect(typeof decoded.id).toBe('string');

          expect(decoded).toHaveProperty('phone', phone);
          // email not provided during registration, so it should be null or absent
          expect(decoded.email === null || decoded.email === undefined).toBe(true);

          expect(decoded).toHaveProperty('role', role);
          expect(decoded).toHaveProperty('is_verified', true);

          // tokenId must be present (used for refresh token rotation)
          expect(decoded).toHaveProperty('tokenId');
          expect(typeof decoded.tokenId).toBe('string');

          // Token must not be expired (iat and exp must be present and valid)
          expect(decoded).toHaveProperty('iat');
          expect(decoded).toHaveProperty('exp');
          expect(decoded.exp).toBeGreaterThan(decoded.iat);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('holds for email-based login', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('customer', 'restaurant_owner', 'delivery'),
        async (role) => {
          const email = uniqueEmail();
          // Register via email
          const regRes = await request(app)
            .post('/api/auth/register')
            .send({ name: 'PBT Email User', email, password: 'Password123!', role });
          expect(regRes.status).toBe(201);
          // User is now auto-verified on registration
          // const otp = await redis.get(`otp:${email}`);
          // await request(app).post('/api/auth/verify-otp').send({ identifier: email, otp });

          const loginRes = await request(app)
            .post('/api/auth/login/password')
            .send({ identifier: email, password: 'Password123!', role });
          expect(loginRes.status).toBe(200);
          const { accessToken } = loginRes.body.data;

          const decoded = verifyToken(accessToken);

          // Requirement 2.5: JWT payload must include id, phone, email, role, is_verified
          expect(decoded).toHaveProperty('id');
          expect(typeof decoded.id).toBe('string');

          expect(decoded).toHaveProperty('email', email);
          // phone not provided during registration, so it should be null or absent
          expect(decoded.phone === null || decoded.phone === undefined).toBe(true);

          expect(decoded).toHaveProperty('role', role);
          expect(decoded).toHaveProperty('is_verified', true);

          expect(decoded).toHaveProperty('tokenId');
          expect(typeof decoded.tokenId).toBe('string');

          expect(decoded.exp).toBeGreaterThan(decoded.iat);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('JWT id claim always matches the registered user id in DB', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('customer', 'restaurant_owner', 'delivery'),
        async (role) => {
          const phone = uniquePhone();
          await registerAndVerify(phone, 'Password123!', role);
          const { accessToken } = await loginAndGetTokens(phone, 'Password123!', role);

          const decoded = verifyToken(accessToken);

          // The id in the token must match the actual user record in the DB
          const user = await prisma.user.findFirst({ where: { phone } });
          expect(decoded.id).toBe(user.id);
          expect(decoded.role).toBe(user.role);
          expect(decoded.is_verified).toBe(user.is_verified);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('each login issues a unique tokenId (no token reuse)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const phone = uniquePhone();
          await registerAndVerify(phone, 'Password123!', 'customer');

          const { accessToken: token1 } = await loginAndGetTokens(phone, 'Password123!', 'customer');
          const { accessToken: token2 } = await loginAndGetTokens(phone, 'Password123!', 'customer');

          const decoded1 = verifyToken(token1);
          const decoded2 = verifyToken(token2);

          // Each login session must produce a distinct tokenId
          expect(decoded1.tokenId).not.toBe(decoded2.tokenId);
          // But both must carry the same user id and role
          expect(decoded1.id).toBe(decoded2.id);
          expect(decoded1.role).toBe(decoded2.role);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 6: Role mismatch at login always returns 403 ───────────────────
// **Validates: Requirements 2.4**
describe('Property 6: Role mismatch at login always returns 403', () => {
  it('holds for any role pair where roles differ', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          ['customer', 'restaurant_owner'],
          ['customer', 'delivery'],
          ['restaurant_owner', 'customer'],
          ['delivery', 'customer']
        ),
        async ([registeredRole, loginRole]) => {
          const phone = uniquePhone();
          await registerAndVerify(phone, 'Password123!', registeredRole);

          const res = await request(app)
            .post('/api/auth/login/password')
            .send({ identifier: phone, password: 'Password123!', role: loginRole });
          expect(res.status).toBe(403);
          expect(res.body.success).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 7: Refresh token always preserves role claim ───────────────────
// **Validates: Requirements 2.7**
describe('Property 7: Refresh token always preserves role claim', () => {
  it('holds for any role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('customer', 'restaurant_owner', 'delivery'),
        async (role) => {
          const phone = uniquePhone();
          await registerAndVerify(phone, 'Password123!', role);
          const { accessToken: oldAccess, refreshToken } = await loginAndGetTokens(phone, 'Password123!', role);

          const oldDecoded = verifyToken(oldAccess);

          const refreshRes = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken });
          expect(refreshRes.status).toBe(200);

          const newDecoded = verifyToken(refreshRes.body.data.accessToken);
          expect(newDecoded.role).toBe(oldDecoded.role);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 8: Post-logout refresh always returns 401 ──────────────────────
// **Validates: Requirements 2.9**
describe('Property 8: Post-logout refresh always returns 401', () => {
  it('holds for any authenticated user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const phone = uniquePhone();
          await registerAndVerify(phone);
          const { accessToken, refreshToken } = await loginAndGetTokens(phone);

          // Logout
          await request(app)
            .post('/api/auth/logout')
            .set(authHeader(accessToken))
            .send({});

          // Refresh with old token must fail
          const res = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken });
          expect(res.status).toBe(401);
          expect(res.body.success).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 9: Invalid JWT always rejected ──────────────────────────────────
// **Validates: Requirements 2.10**
describe('Property 9: Invalid JWT always rejected', () => {
  const PROTECTED_ENDPOINTS = [
    { method: 'get',   path: '/api/users/me' },
    { method: 'get',   path: '/api/orders' },
    { method: 'get',   path: '/api/notifications' },
    { method: 'get',   path: '/api/cart' },
  ];

  // 9a: Arbitrary random strings are always rejected with 401
  it('arbitrary strings as Bearer token always return 401', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.constantFrom(...PROTECTED_ENDPOINTS),
        async (fakeToken, endpoint) => {
          const res = await request(app)
            [endpoint.method](endpoint.path)
            .set('Authorization', `Bearer ${fakeToken}`);
          expect(res.status).toBe(401);
          expect(res.body.success).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  // 9b: Missing Authorization header always returns 401
  it('missing Authorization header always returns 401', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...PROTECTED_ENDPOINTS),
        async (endpoint) => {
          const res = await request(app)[endpoint.method](endpoint.path);
          expect(res.status).toBe(401);
          expect(res.body.success).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });

  // 9c: Wrong Authorization scheme (Basic, Token, etc.) always returns 401
  it('wrong Authorization scheme always returns 401', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('Basic', 'Token', 'Digest', 'ApiKey'),
        fc.constantFrom(...PROTECTED_ENDPOINTS),
        async (scheme, endpoint) => {
          const res = await request(app)
            [endpoint.method](endpoint.path)
            .set('Authorization', `${scheme} somevalue`);
          expect(res.status).toBe(401);
          expect(res.body.success).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });

  // 9d: Structurally valid JWT signed with a wrong secret always returns 401
  it('JWT signed with wrong secret always returns 401', async () => {
    const jwt = require('jsonwebtoken');
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('customer', 'restaurant_owner', 'delivery', 'admin'),
        fc.constantFrom(...PROTECTED_ENDPOINTS),
        async (role, endpoint) => {
          // Sign with a different secret — structurally valid JWT but wrong signature
          const fakeToken = jwt.sign(
            { id: 'fake-id', role, is_verified: true },
            'wrong-secret-key',
            { expiresIn: '15m' }
          );
          const res = await request(app)
            [endpoint.method](endpoint.path)
            .set('Authorization', `Bearer ${fakeToken}`);
          expect(res.status).toBe(401);
          expect(res.body.success).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });

  // 9e: Expired JWT always returns 401
  it('expired JWT always returns 401', async () => {
    const jwt = require('jsonwebtoken');
    const env = require('../../src/config/env');
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('customer', 'restaurant_owner', 'delivery'),
        fc.constantFrom(...PROTECTED_ENDPOINTS),
        async (role, endpoint) => {
          // Sign with correct secret but already-expired (expiresIn: 0s)
          const expiredToken = jwt.sign(
            { id: 'some-id', role, is_verified: true },
            env.JWT_SECRET,
            { expiresIn: 0 }
          );
          const res = await request(app)
            [endpoint.method](endpoint.path)
            .set('Authorization', `Bearer ${expiredToken}`);
          expect(res.status).toBe(401);
          expect(res.body.success).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });

  // 9f: Tampered JWT payload (valid header+signature structure but modified body) always returns 401
  it('tampered JWT payload always returns 401', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const phone = uniquePhone();
          await registerAndVerify(phone);
          const { accessToken } = await loginAndGetTokens(phone);

          // Split the JWT and tamper with the payload segment
          const [header, , signature] = accessToken.split('.');
          const tamperedPayload = Buffer.from(
            JSON.stringify({ id: 'tampered-id', role: 'admin', is_verified: true })
          ).toString('base64url');
          const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

          const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${tamperedToken}`);
          expect(res.status).toBe(401);
          expect(res.body.success).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });

  // 9g: JWT with missing signature segment always returns 401
  it('JWT with stripped signature always returns 401', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const phone = uniquePhone();
          await registerAndVerify(phone);
          const { accessToken } = await loginAndGetTokens(phone);

          // Remove the signature — "alg:none" style attack
          const [header, payload] = accessToken.split('.');
          const noSigToken = `${header}.${payload}.`;

          const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${noSigToken}`);
          expect(res.status).toBe(401);
          expect(res.body.success).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 10: Profile GET/PATCH round-trip always consistent ──────────────
// **Validates: Requirements 3.1, 3.2**
describe('Property 10: Profile GET/PATCH round-trip always consistent', () => {
  it('holds for any name update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (newName) => {
          const user = await createTestUser({ role: 'customer' });

          await request(app)
            .patch('/api/users/me')
            .set(authHeader(user.accessToken))
            .send({ name: newName.trim() });

          const getRes = await request(app)
            .get('/api/users/me')
            .set(authHeader(user.accessToken));

          expect(getRes.status).toBe(200);
          expect(getRes.body.data.name).toBe(newName.trim());
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 11: Address delete by non-owner always returns 403 ──────────────
// **Validates: Requirements 3.5**
describe('Property 11: Address delete by non-owner always returns 403', () => {
  it('holds for any two distinct customers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const owner = await createTestUser({ role: 'customer' });
          const other = await createTestUser({ role: 'customer' });

          // Create address directly in DB for owner
          const addr = await prisma.address.create({
            data: {
              userId: owner.id,
              line1: '123 Main St',
              city: 'Testville',
              state: 'TS',
              pincode: '12345',
            },
          });

          // Other user tries to delete owner's address
          const res = await request(app)
            .delete(`/api/users/addresses/${addr.id}`)
            .set(authHeader(other.accessToken));
          expect(res.status).toBe(403);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 12: Address add/delete round-trip always consistent ─────────────
// **Validates: Requirements 3.3, 3.4**
describe('Property 12: Address add/delete round-trip always consistent', () => {
  it('holds for any valid address data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          address: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length >= 5),
          lat: fc.float({ min: -90, max: 90, noNaN: true }),
          lng: fc.float({ min: -180, max: 180, noNaN: true }),
        }),
        async ({ address, lat, lng }) => {
          const user = await createTestUser({ role: 'customer' });

          // Add address
          const addRes = await request(app)
            .post('/api/users/addresses')
            .set(authHeader(user.accessToken))
            .send({ address: address.trim(), lat, lng });
          expect(addRes.status).toBe(201);
          const addrId = addRes.body.data.id;

          // Delete address
          const delRes = await request(app)
            .delete(`/api/users/addresses/${addrId}`)
            .set(authHeader(user.accessToken));
          expect(delRes.status).toBe(200);

          // Verify it's gone
          const found = await prisma.address.findUnique({ where: { id: addrId } });
          expect(found).toBeNull();
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 13: Pagination invariants ──────────────────────────────────────
// **Validates: Requirements 6.5**
describe('Property 13: Pagination invariants', () => {
  it('items.length <= limit, total >= items.length, page/limit echoed back', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          n: fc.integer({ min: 1, max: 8 }),
          limit: fc.integer({ min: 1, max: 5 }),
          page: fc.integer({ min: 1, max: 3 }),
        }),
        async ({ n, limit, page }) => {
          const customer = await createTestUser({ role: 'customer' });
          const restaurant = await createTestRestaurant();

          // Seed n orders
          for (let i = 0; i < n; i++) {
            await createTestOrder({ userId: customer.id, restaurantId: restaurant.id });
          }

          const res = await request(app)
            .get(`/api/orders?page=${page}&limit=${limit}`)
            .set(authHeader(customer.accessToken));

          expect(res.status).toBe(200);
          const { orders, total } = res.body.data;
          expect(Array.isArray(orders)).toBe(true);
          expect(orders.length).toBeLessThanOrEqual(limit);
          expect(total).toBeGreaterThanOrEqual(orders.length);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 14: Menu always grouped by category ────────────────────────────
// **Validates: Requirements 4.2**
describe('Property 14: Menu always grouped by category', () => {
  it('each key in menu object contains only items of that category', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom('Starters', 'Mains', 'Desserts', 'Drinks'),
          { minLength: 2, maxLength: 4 }
        ),
        async (categories) => {
          const restaurant = await createTestRestaurant();

          // Create one item per category
          for (const cat of categories) {
            await prisma.menuItem.create({
              data: {
                restaurantId: restaurant.id,
                name: `Item-${cat}`,
                price: 9.99,
                category: cat,
                isAvailable: true,
              },
            });
          }

          const res = await request(app).get(`/api/restaurants/${restaurant.id}`);
          expect(res.status).toBe(200);

          const menu = res.body.data.menu;
          expect(typeof menu).toBe('object');

          // Each key must only contain items of that category
          for (const [cat, items] of Object.entries(menu)) {
            expect(Array.isArray(items)).toBe(true);
            for (const item of items) {
              expect(item.category).toBe(cat);
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 15: Non-owner menu operations always return 403 ─────────────────
// **Validates: Requirements 5.3**
describe('Property 15: Non-owner menu operations always return 403', () => {
  it('holds for any restaurant_owner who does not own the restaurant', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const owner = await createTestUser({ role: 'restaurant_owner' });
          const nonOwner = await createTestUser({ role: 'restaurant_owner' });
          const restaurant = await createTestRestaurant();

          // Set owner on restaurant
          await prisma.restaurant.update({
            where: { id: restaurant.id },
            data: { ownerId: owner.id },
          });

          // Non-owner tries to add menu item
          const res = await request(app)
            .post(`/api/restaurants/${restaurant.id}/menu`)
            .set(authHeader(nonOwner.accessToken))
            .send({ name: 'Burger', price: 9.99, category: 'Mains' });
          expect(res.status).toBe(403);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 16: Menu item add/update round-trip always consistent ───────────
// **Validates: Requirements 5.1, 5.2**
describe('Property 16: Menu item add/update round-trip always consistent', () => {
  it('holds for any valid price and name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2),
          price: fc.float({ min: 0.01, max: 999.99, noNaN: true }),
          updatedPrice: fc.float({ min: 0.01, max: 999.99, noNaN: true }),
        }),
        async ({ name, price, updatedPrice }) => {
          const owner = await createTestUser({ role: 'restaurant_owner' });
          const restaurant = await createTestRestaurant();
          await prisma.restaurant.update({
            where: { id: restaurant.id },
            data: { ownerId: owner.id },
          });

          // Add item
          const addRes = await request(app)
            .post(`/api/restaurants/${restaurant.id}/menu`)
            .set(authHeader(owner.accessToken))
            .send({ name: name.trim(), price, category: 'Mains' });
          expect(addRes.status).toBe(201);
          const itemId = addRes.body.data.id;

          // Update price
          const updateRes = await request(app)
            .patch(`/api/restaurants/${restaurant.id}/menu/${itemId}`)
            .set(authHeader(owner.accessToken))
            .send({ price: updatedPrice });
          expect(updateRes.status).toBe(200);
          expect(updateRes.body.data.price).toBeCloseTo(updatedPrice, 2);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 17: Order creation always sets pending status with correct total ─
// **Validates: Requirements 6.1**
describe('Property 17: Order creation always sets pending status with correct total', () => {
  it('holds for any valid item quantities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 3 }),
        async (quantities) => {
          const customer = await createTestUser({ role: 'customer' });
          const restaurant = await createTestRestaurant();

          // Create menu items with known prices
          const menuItems = await Promise.all(
            quantities.map((_, i) =>
              createTestMenuItem({ restaurantId: restaurant.id, price: 10.00 + i })
            )
          );

          const items = menuItems.map((mi, i) => ({
            menu_item_id: mi.id,
            quantity: quantities[i],
          }));

          const expectedTotal = menuItems.reduce(
            (sum, mi, i) => sum + mi.price * quantities[i],
            0
          );

          const res = await request(app)
            .post('/api/orders')
            .set(authHeader(customer.accessToken))
            .send({ restaurant_id: restaurant.id, address_id: 'addr-1', items });

          expect(res.status).toBe(201);
          expect(res.body.data.status).toBe('PENDING');
          expect(res.body.data.totalAmount).toBeCloseTo(expectedTotal, 2);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 18: Cross-restaurant item always returns 400 ───────────────────
// **Validates: Requirements 6.2**
describe('Property 18: Cross-restaurant item always returns 400', () => {
  it('holds when menu item belongs to a different restaurant', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const customer = await createTestUser({ role: 'customer' });
          const restaurantA = await createTestRestaurant();
          const restaurantB = await createTestRestaurant();

          // Item belongs to B, but order is for A
          const itemFromB = await createTestMenuItem({ restaurantId: restaurantB.id });

          const res = await request(app)
            .post('/api/orders')
            .set(authHeader(customer.accessToken))
            .send({
              restaurant_id: restaurantA.id,
              address_id: 'addr-1',
              items: [{ menu_item_id: itemFromB.id, quantity: 1 }],
            });
          expect(res.status).toBe(400);
          expect(res.body.success).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 19: Cancellation state machine always enforced ─────────────────
// **Validates: Requirements 6.3, 6.4**
describe('Property 19: Cancellation state machine always enforced', () => {
  it('PENDING and CONFIRMED are cancellable; others are not', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          cancellable: fc.constantFrom('PENDING', 'CONFIRMED'),
          nonCancellable: fc.constantFrom('PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'),
        }),
        async ({ cancellable, nonCancellable }) => {
          const customer = await createTestUser({ role: 'customer' });
          const restaurant = await createTestRestaurant();

          // Test cancellable status
          const order1 = await createTestOrder({
            userId: customer.id,
            restaurantId: restaurant.id,
            status: cancellable,
          });
          const res1 = await request(app)
            .post(`/api/orders/${order1.id}/cancel`)
            .set(authHeader(customer.accessToken));
          expect(res1.status).toBe(200);

          // Test non-cancellable status
          const order2 = await createTestOrder({
            userId: customer.id,
            restaurantId: restaurant.id,
            status: nonCancellable,
          });
          const res2 = await request(app)
            .post(`/api/orders/${order2.id}/cancel`)
            .set(authHeader(customer.accessToken));
          expect(res2.status).toBe(400);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 20: Order list always isolated to requesting customer ───────────
// **Validates: Requirements 6.5**
describe('Property 20: Order list always isolated to requesting customer', () => {
  it('customer only sees their own orders', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        async (n) => {
          const customer1 = await createTestUser({ role: 'customer' });
          const customer2 = await createTestUser({ role: 'customer' });
          const restaurant = await createTestRestaurant();

          // Create orders for both customers
          for (let i = 0; i < n; i++) {
            await createTestOrder({ userId: customer1.id, restaurantId: restaurant.id });
            await createTestOrder({ userId: customer2.id, restaurantId: restaurant.id });
          }

          const res = await request(app)
            .get('/api/orders')
            .set(authHeader(customer1.accessToken));

          expect(res.status).toBe(200);
          const orders = res.body.data.orders;
          for (const order of orders) {
            expect(order.userId).toBe(customer1.id);
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 21: Status update always emits socket event ────────────────────
// **Validates: Requirements 6.6, 11.3**
describe('Property 21: Status update always emits socket event to customer room', () => {
  it('holds for any valid status transition', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          ['PENDING', 'CONFIRMED'],
          ['CONFIRMED', 'PREPARING'],
          ['PREPARING', 'OUT_FOR_DELIVERY']
        ),
        async ([fromStatus, toStatus]) => {
          const owner = await createTestUser({ role: 'restaurant_owner' });
          const customer = await createTestUser({ role: 'customer' });
          const restaurant = await createTestRestaurant();

          const order = await createTestOrder({
            userId: customer.id,
            restaurantId: restaurant.id,
            status: fromStatus,
          });

          // Spy on io.to(...).emit
          const emitSpy = jest.fn();
          const toSpy = jest.spyOn(io, 'to').mockReturnValue({ emit: emitSpy });

          const res = await request(app)
            .patch(`/api/orders/${order.id}/status`)
            .set(authHeader(owner.accessToken))
            .send({ status: toStatus });

          expect(res.status).toBe(200);

          // Verify socket event was emitted to the customer's room
          const roomCalls = toSpy.mock.calls.map(c => c[0]);
          expect(roomCalls).toContain(`user:${customer.id}`);

          toSpy.mockRestore();
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 22: Delivery acceptance assigns agent; double-accept always 409 ─
// **Validates: Requirements 7.2, 7.3**
describe('Property 22: Delivery acceptance assigns agent; double-accept always 409', () => {
  it('holds for any confirmed order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const agent1 = await createTestUser({ role: 'delivery' });
          const agent2 = await createTestUser({ role: 'delivery' });
          const customer = await createTestUser({ role: 'customer' });
          const restaurant = await createTestRestaurant();

          const order = await createTestOrder({
            userId: customer.id,
            restaurantId: restaurant.id,
            status: 'CONFIRMED',
          });

          // First agent accepts — order moves to OUT_FOR_DELIVERY and tracking is created
          const res1 = await request(app)
            .post(`/api/delivery/${order.id}/accept`)
            .set(authHeader(agent1.accessToken));
          expect(res1.status).toBe(200);

          // Reset order status to CONFIRMED so second agent can attempt accept
          // (simulates race condition where both agents see CONFIRMED simultaneously)
          await prisma.order.update({ where: { id: order.id }, data: { status: 'CONFIRMED' } });

          // Second agent tries to accept same order — tracking already exists → 409
          const res2 = await request(app)
            .post(`/api/delivery/${order.id}/accept`)
            .set(authHeader(agent2.accessToken));
          expect(res2.status).toBe(409);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 23: Location update always persists and emits to customer ───────
// **Validates: Requirements 7.4**
describe('Property 23: Location update always persists and emits to customer', () => {
  it('holds for any valid lat/lng', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          lat: fc.float({ min: -90, max: 90, noNaN: true }),
          lng: fc.float({ min: -180, max: 180, noNaN: true }),
        }),
        async ({ lat, lng }) => {
          const agent = await createTestUser({ role: 'delivery' });
          const customer = await createTestUser({ role: 'customer' });
          const restaurant = await createTestRestaurant();

          const order = await createTestOrder({
            userId: customer.id,
            restaurantId: restaurant.id,
            status: 'CONFIRMED',
          });

          // Accept order first
          await request(app)
            .post(`/api/delivery/${order.id}/accept`)
            .set(authHeader(agent.accessToken));

          // Spy on socket emit
          const emitSpy = jest.fn();
          const toSpy = jest.spyOn(io, 'to').mockReturnValue({ emit: emitSpy });

          const res = await request(app)
            .post(`/api/delivery/${order.id}/location`)
            .set(authHeader(agent.accessToken))
            .send({ lat, lng });

          expect(res.status).toBe(200);

          // Verify location persisted
          const tracking = await prisma.deliveryTracking.findUnique({ where: { orderId: order.id } });
          expect(tracking.currentLat).toBeCloseTo(lat, 4);
          expect(tracking.currentLng).toBeCloseTo(lng, 4);

          // Verify socket event emitted
          const roomCalls = toSpy.mock.calls.map(c => c[0]);
          expect(roomCalls.some(r => r.includes('order:'))).toBe(true);

          toSpy.mockRestore();
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 24: Order completion always sets delivered ─────────────────────
// **Validates: Requirements 7.5**
describe('Property 24: Order completion always sets delivered', () => {
  it('holds for any assigned delivery agent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const agent = await createTestUser({ role: 'delivery' });
          const customer = await createTestUser({ role: 'customer' });
          const restaurant = await createTestRestaurant();

          const order = await createTestOrder({
            userId: customer.id,
            restaurantId: restaurant.id,
            status: 'CONFIRMED',
          });

          // Accept order
          await request(app)
            .post(`/api/delivery/${order.id}/accept`)
            .set(authHeader(agent.accessToken));

          // Complete order
          const res = await request(app)
            .post(`/api/delivery/${order.id}/complete`)
            .set(authHeader(agent.accessToken));

          expect(res.status).toBe(200);

          const updated = await prisma.order.findUnique({ where: { id: order.id } });
          expect(updated.status).toBe('DELIVERED');
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 25: Payment lifecycle always transitions correctly ──────────────
// **Validates: Requirements 8.1, 8.2, 8.3**
describe('Property 25: Payment lifecycle always transitions correctly', () => {
  it('pending → SUCCESS on success, pending → FAILED on failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (success) => {
          const customer = await createTestUser({ role: 'customer' });
          const restaurant = await createTestRestaurant();
          const order = await createTestOrder({
            userId: customer.id,
            restaurantId: restaurant.id,
            status: 'PENDING',
          });

          // Create payment
          const createRes = await request(app)
            .post('/api/payments')
            .set(authHeader(customer.accessToken))
            .send({ orderId: order.id, amount: order.totalAmount, method: 'CARD' });
          expect(createRes.status).toBe(201);
          expect(createRes.body.data.payment.status).toBe('pending');

          const paymentId = createRes.body.data.payment.id;

          // Verify payment
          const verifyRes = await request(app)
            .post('/api/payments/verify')
            .set(authHeader(customer.accessToken))
            .send({ paymentId, success });

          expect(verifyRes.status).toBe(200);
          const expectedStatus = success ? 'SUCCESS' : 'FAILED';
          expect(verifyRes.body.data.payment.status).toBe(expectedStatus);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 26: Refund eligibility always enforced ─────────────────────────
// **Validates: Requirements 8.4, 8.5**
describe('Property 26: Refund eligibility always enforced', () => {
  it('refund requires SUCCESS payment AND CANCELLED order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          { payStatus: 'pending', orderStatus: 'CANCELLED', expectCode: 400 },
          { payStatus: 'FAILED', orderStatus: 'CANCELLED', expectCode: 400 },
          { payStatus: 'SUCCESS', orderStatus: 'PENDING', expectCode: 400 }
        ),
        async ({ payStatus, orderStatus, expectCode }) => {
          const customer = await createTestUser({ role: 'customer' });
          const restaurant = await createTestRestaurant();
          const order = await createTestOrder({
            userId: customer.id,
            restaurantId: restaurant.id,
            status: orderStatus,
          });
          const payment = await createTestPayment({
            orderId: order.id,
            status: payStatus,
          });

          const res = await request(app)
            .post(`/api/payments/${payment.id}/refund`)
            .set(authHeader(customer.accessToken));
          expect(res.status).toBe(expectCode);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('refund succeeds when payment=SUCCESS and order=CANCELLED', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const customer = await createTestUser({ role: 'customer' });
          const restaurant = await createTestRestaurant();
          const order = await createTestOrder({
            userId: customer.id,
            restaurantId: restaurant.id,
            status: 'CANCELLED',
          });
          const payment = await createTestPayment({
            orderId: order.id,
            status: 'SUCCESS',
          });

          const res = await request(app)
            .post(`/api/payments/${payment.id}/refund`)
            .set(authHeader(customer.accessToken));
          expect(res.status).toBe(200);
          expect(res.body.data.status).toBe('REFUNDED');
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 27: Notification round-trip always stores required fields ───────
// **Validates: Requirements 9.3, 9.4**
describe('Property 27: Notification round-trip always stores required fields', () => {
  it('holds for any notification type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          message: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          type: fc.constantFrom('order_update', 'delivery_update', 'promotion'),
        }),
        async ({ title, message, type }) => {
          const user = await createTestUser({ role: 'customer' });

          // Create notification directly via Prisma (service layer)
          await prisma.notification.create({
            data: {
              userId: user.id,
              title: title.trim(),
              message: message.trim(),
              type,
              isRead: false,
            },
          });

          // Retrieve via API
          const res = await request(app)
            .get('/api/notifications')
            .set(authHeader(user.accessToken));

          expect(res.status).toBe(200);
          const notifications = res.body.data.notifications;
          expect(notifications.length).toBeGreaterThan(0);

          const notif = notifications[0];
          expect(notif).toHaveProperty('userId', user.id);
          expect(notif).toHaveProperty('title');
          expect(notif).toHaveProperty('message');
          expect(notif).toHaveProperty('type');
          expect(notif).toHaveProperty('isRead', false);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 28: Socket events always isolated to correct user rooms ─────────
// **Validates: Requirements 11.3, 11.4**
describe('Property 28: Socket events always isolated to correct user rooms', () => {
  it('order_status_update emitted only to the customer room', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const owner = await createTestUser({ role: 'restaurant_owner' });
          const customer = await createTestUser({ role: 'customer' });
          const restaurant = await createTestRestaurant();

          const order = await createTestOrder({
            userId: customer.id,
            restaurantId: restaurant.id,
            status: 'PENDING',
          });

          const emitSpy = jest.fn();
          const toSpy = jest.spyOn(io, 'to').mockReturnValue({ emit: emitSpy });

          await request(app)
            .patch(`/api/orders/${order.id}/status`)
            .set(authHeader(owner.accessToken))
            .send({ status: 'CONFIRMED' });

          // The room targeted must be the customer's user room
          const rooms = toSpy.mock.calls.map(c => c[0]);
          expect(rooms).toContain(`user:${customer.id}`);
          // Must NOT target other user rooms
          expect(rooms).not.toContain(`user:${owner.id}`);

          toSpy.mockRestore();
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 29: new_delivery_request always broadcast to all delivery agents ─
// **Validates: Requirements 7.1, 11.6**
describe('Property 29: new_delivery_request always broadcast to delivery_agents room', () => {
  it('holds when order transitions to CONFIRMED', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const owner = await createTestUser({ role: 'restaurant_owner' });
          const customer = await createTestUser({ role: 'customer' });
          const restaurant = await createTestRestaurant();

          const order = await createTestOrder({
            userId: customer.id,
            restaurantId: restaurant.id,
            status: 'PENDING',
          });

          const emitSpy = jest.fn();
          const toSpy = jest.spyOn(io, 'to').mockReturnValue({ emit: emitSpy });

          // Transition to CONFIRMED — should broadcast to delivery_agents
          await request(app)
            .patch(`/api/orders/${order.id}/status`)
            .set(authHeader(owner.accessToken))
            .send({ status: 'CONFIRMED' });

          const rooms = toSpy.mock.calls.map(c => c[0]);
          expect(rooms).toContain('delivery_agents');

          toSpy.mockRestore();
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 30: RBAC always returns 403 for wrong-role requests ─────────────
// **Validates: Requirements 12.4–12.8**
describe('Property 30: RBAC always returns 403 for wrong-role requests', () => {
  it('holds for various role/endpoint combinations', async () => {
    const rbacCases = [
      // [method, path, body, allowedRole, forbiddenRole]
      ['post', '/api/orders', { restaurant_id: 'x', address_id: 'x', items: [{ menu_item_id: 'x', quantity: 1 }] }, 'customer', 'restaurant_owner'],
      ['get', '/api/orders', null, 'customer', 'delivery'],
      ['post', '/api/payments', { orderId: 'x', amount: 10, method: 'CARD' }, 'customer', 'admin'],
      ['get', '/api/admin/analytics', null, 'admin', 'customer'],
      ['post', '/api/delivery/some-id/accept', null, 'delivery', 'customer'],
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...rbacCases),
        async ([method, path, body, , forbiddenRole]) => {
          const token = signAccessToken({ id: 'test-id', phone: '+10000000001', role: forbiddenRole });
          let req = request(app)[method](path).set(authHeader(token));
          if (body) req = req.send(body);
          const res = await req;
          expect(res.status).toBe(403);
        }
      ),
      { numRuns: 10 }
    );
  });
});

// ─── Property 31: Response envelope always matches success/error shape ─────────
// **Validates: Requirements 13.1, 13.2**
describe('Property 31: Response envelope always matches success/error shape', () => {
  it('successful responses have { success: true, message, data }', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const user = await createTestUser({ role: 'customer' });
          const res = await request(app)
            .get('/api/users/me')
            .set(authHeader(user.accessToken));

          expect(res.status).toBe(200);
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('data');
        }
      ),
      { numRuns: 5 }
    );
  });

  it('error responses have { success: false, message }', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          ['get', '/api/users/me', null],
          ['post', '/api/orders', { restaurant_id: 'x', address_id: 'x', items: [{ menu_item_id: 'x', quantity: 1 }] }],
          ['get', '/api/admin/analytics', null]
        ),
        async ([method, path, body]) => {
          // No auth token — should return 401 with error shape
          let req = request(app)[method](path);
          if (body) req = req.send(body);
          const res = await req;

          expect(res.status).toBeGreaterThanOrEqual(400);
          expect(res.body).toHaveProperty('success', false);
          expect(res.body).toHaveProperty('message');
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 32: Validation failure always returns 422 with field errors ─────
// **Validates: Requirements 13.4**
describe('Property 32: Validation failure always returns 422 with field errors', () => {
  it('holds for invalid registration bodies', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          // Missing name
          { phone: '+15550000001', password: 'Password123!', role: 'customer' },
          // Missing both email and phone
          { name: 'Test', password: 'Password123!', role: 'customer' },
          // Invalid role
          { name: 'Test', phone: '+15550000002', password: 'Password123!', role: 'superadmin' },
          // Short password
          { name: 'Test', phone: '+15550000003', password: 'short', role: 'customer' }
        ),
        async (body) => {
          const res = await request(app)
            .post('/api/auth/register')
            .send(body);

          expect(res.status).toBe(422);
          expect(res.body.success).toBe(false);
          expect(res.body).toHaveProperty('message');
          // Should have errors array with field/message
          if (res.body.errors) {
            expect(Array.isArray(res.body.errors)).toBe(true);
            for (const err of res.body.errors) {
              expect(err).toHaveProperty('field');
              expect(err).toHaveProperty('message');
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Property 33: Rate limiting always rejects beyond 100 req/min per IP ──────
// **Validates: Requirements 13.5**
describe('Property 33: Rate limiting always rejects beyond 100 req/min per IP', () => {
  it('101st request returns 429', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Flush ALL rate limit keys to start fresh
          const keys = await redis.keys('rate:*');
          if (keys.length) await redis.del(...keys);

          let last429 = false;
          // Send 101 requests — the 101st must be rate-limited
          for (let i = 0; i < 101; i++) {
            const res = await request(app)
              .post('/api/auth/register')
              .send({ name: 'X', phone: uniquePhone(), password: 'Password123!', role: 'customer' });
            if (i === 100) {
              // 101st request (index 100) must be 429
              expect(res.status).toBe(429);
              expect(res.body.success).toBe(false);
              last429 = true;
            }
          }
          expect(last429).toBe(true);
        }
      ),
      { numRuns: 1 }
    );
  });
});

// ─── Property 34: Analytics always returns correct aggregates for date range ──
// **Validates: Requirements 10.3**
describe('Property 34: Analytics always returns correct aggregates for date range', () => {
  it('totalOrders matches seeded orders within date range', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (n) => {
          const admin = await createTestUser({ role: 'admin' });
          const customer = await createTestUser({ role: 'customer' });
          const restaurant = await createTestRestaurant();

          const now = new Date();
          const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

          // Seed n orders with today's date
          for (let i = 0; i < n; i++) {
            await createTestOrder({
              userId: customer.id,
              restaurantId: restaurant.id,
              status: 'PENDING',
            });
          }

          const adminToken = signAccessToken({ id: admin.id, phone: admin.phone, role: 'admin' });

          const res = await request(app)
            .get(`/api/admin/analytics?startDate=${startDate}&endDate=${endDate}`)
            .set(authHeader(adminToken));

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('totalOrders');
          expect(res.body.data).toHaveProperty('totalRevenue');
          expect(res.body.data).toHaveProperty('activeRestaurants');
          expect(res.body.data).toHaveProperty('activeDeliveryAgents');
          // totalOrders should be at least n (may include orders from other tests if not cleaned)
          expect(res.body.data.totalOrders).toBeGreaterThanOrEqual(n);
        }
      ),
      { numRuns: 5 }
    );
  });
});
