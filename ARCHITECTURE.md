# Architecture Overview

This document describes the folder structure, purpose of each directory, and how to run the food delivery backend.

---

## How to Run

### Prerequisites

- Node.js 18+
- A MongoDB Atlas cluster (or local MongoDB)
- A Redis instance (Upstash, local, or any Redis-compatible service)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env` and fill in your values:

```env
DATABASE_URL="mongodb+srv://<user>:<pass>@cluster.mongodb.net/food_delivery"
REDIS_URL="rediss://default:<pass>@<host>:6379"
JWT_SECRET="your_jwt_secret"
JWT_REFRESH_SECRET="your_refresh_secret"
PORT=3000
FCM_SERVER_KEY="your_fcm_key"          # optional — push notifications
RAZORPAY_KEY_ID="rzp_test_xxx"         # optional — falls back to mock if absent
RAZORPAY_KEY_SECRET="your_secret"
RAZORPAY_WEBHOOK_SECRET="your_webhook_secret"
GOOGLE_MAPS_API_KEY="your_maps_key"    # optional — skipped if absent
```

### 3. Generate Prisma client

```bash
npx prisma generate
```

### 4. Push schema to database

```bash
npx prisma db push
```

### 5. Start the server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Server starts on `http://localhost:3000` (or the `PORT` you set).

---

### Running Tests

Tests use a separate `.env.test` file pointing to a `food_delivery_test` database.

```bash
# Run all tests
npm test

# Run only integration tests
npx jest tests/integration --runInBand --forceExit

# Run only unit tests
npx jest tests/unit --forceExit

# Run only property-based tests
npx jest tests/pbt --runInBand --forceExit

# Run a single test file
npx jest tests/integration/auth.test.js --runInBand --forceExit
```

> `--runInBand` is recommended for integration and PBT tests to avoid DB race conditions.

---

## Project Structure

```
.
├── server.js                  # Entry point
├── prisma/
│   ├── schema.prisma          # Data models
│   └── migrations/            # Migration history
├── src/
│   ├── config/                # DB, Redis, env config
│   ├── common/
│   │   ├── middleware/        # Auth, RBAC, validation, rate limiter, error handler
│   │   ├── utils/             # JWT, OTP, logger, response helpers, AppError
│   │   └── constants/         # Roles, order/payment status enums, RBAC matrix
│   ├── modules/               # Feature modules (auth, user, restaurant, order, …)
│   ├── sockets/               # Socket.IO handlers
│   └── jobs/                  # Background jobs
├── tests/
│   ├── integration/           # HTTP integration tests
│   ├── unit/                  # Unit tests
│   ├── pbt/                   # Property-based tests (fast-check)
│   └── __helpers__/           # Factories, test app, setup/teardown
└── docs/
    └── API.md                 # Full API reference
```

---

## `src/config/`

| File | Purpose |
|---|---|
| `env.js` | Loads and validates all environment variables. Throws on missing required vars. |
| `db.js` | Prisma client singleton — reused across the app to avoid connection pool exhaustion |
| `redis.js` | ioredis client singleton — used for OTP storage, refresh tokens, and rate limiting |

---

## `src/common/middleware/`

| File | Purpose |
|---|---|
| `authenticate.js` | Verifies JWT signature and expiry; attaches `req.user` to the request; returns 401 on failure |
| `authorize.js` | Factory `authorize(...roles)` — checks `req.user.role` against allowed roles; returns 403 on mismatch |
| `validate.js` | Joi schema validation wrapper for `req.body`; returns 422 with per-field errors on failure |
| `rateLimiter.js` | Redis-backed sliding window rate limiter — 100 req/min per IP; returns 429 on breach |
| `errorHandler.js` | Global Express error handler — logs full stack via Winston, maps AppError to status codes |

---

## `src/common/utils/`

| File | Purpose |
|---|---|
| `response.js` | `success()` and `error()` helpers — enforce consistent `{ success, message, data }` envelope |
| `jwt.js` | `signAccessToken`, `signRefreshToken`, `verifyToken` helpers |
| `otp.js` | `generateOTP` (6-digit), `storeOTP` (Redis, 5 min TTL), `verifyOTP` helpers |
| `logger.js` | Winston logger with console and file transports |
| `AppError.js` | Custom error class with `statusCode`, `code`, and `message` fields |

---

## `src/common/constants/`

| File | Purpose |
|---|---|
| `roles.js` | Role constants: `CUSTOMER`, `RESTAURANT_OWNER`, `DELIVERY`, `ADMIN` |
| `orderStatus.js` | Order status enum: `PENDING → CONFIRMED → PREPARING → OUT_FOR_DELIVERY → DELIVERED / CANCELLED` |
| `paymentStatus.js` | Payment status enum: `pending`, `SUCCESS`, `FAILED`, `REFUNDED` |
| `rbac.js` | Access matrix mapping each route group to allowed roles |

---

## `src/modules/`

Each module owns its routes, controller, service, and validation.

| Module | Responsibility |
|---|---|
| `auth/` | Registration, OTP verification, password/OTP login, token refresh, logout |
| `user/` | Profile GET/PATCH, address management, favorites, wallet |
| `restaurant/` | Restaurant listing/details, menu management, categories, banners, search |
| `order/` | Order creation, cancellation, status updates, paginated retrieval |
| `cart/` | Cart CRUD, checkout (cart → order) |
| `delivery/` | Agent assignment, live location updates, order completion, dashboard, profile |
| `payment/` | Razorpay order creation, signature verification, webhook, refunds |
| `notification/` | Push notification dispatch and paginated retrieval |
| `admin/` | Restaurant/agent approval, platform analytics |
| `vendor/` | Restaurant owner dashboard, order management, menu management |

Internal structure per module:

```
routes.js      → mounts Express Router, applies middleware, delegates to controller
controller.js  → extracts req data, calls service, sends response
service.js     → business logic, Prisma + Redis interactions
validation.js  → Joi schemas for request body validation
```

---

## `src/sockets/`

| File | Purpose |
|---|---|
| `index.js` | Initializes Socket.IO, applies JWT auth middleware, joins users to their rooms |
| `orderHandlers.js` | `emitOrderStatusUpdate` and `emitNewOrder` helpers |
| `deliveryHandlers.js` | `emitDeliveryLocation` and `emitNewDeliveryRequest` helpers |

---

## `src/jobs/`

| File | Purpose |
|---|---|
| `index.js` | Bootstraps and starts all scheduled jobs |
| `otpCleanup.js` | Runs every 10 minutes — deletes expired OTP records from the database |

---

## Key Design Decisions

- **MongoDB + Prisma** — flexible schema with type-safe queries
- **Redis** — OTP TTL storage, refresh token revocation, rate limiting
- **Socket.IO rooms** — each user joins `user:<id>`; delivery agents also join `delivery_agents`; customers join `order:<id>` for live tracking
- **Razorpay** — falls back to a mock verify flow when `RAZORPAY_KEY_ID` is not set (safe for dev/test)
- **Google Maps** — skipped gracefully when `GOOGLE_MAPS_API_KEY` is absent; location events still emit `{ lat, lng }`
- **JWT** — 15-minute access tokens + 7-day refresh tokens stored in Redis for revocation
