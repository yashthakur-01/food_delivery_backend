# Food Delivery Backend — API Reference

Base URL: `http://localhost:3000`

All protected endpoints require the header:
```
Authorization: Bearer <accessToken>
```

All responses follow the envelope:
```json
{ "success": true, "data": {} }
{ "success": false, "code": "ERROR_CODE", "message": "description" }
```

---

## Health

### GET /health
Check server, database, and Redis connectivity.

**Response 200**
```json
{
  "success": true,
  "status": "healthy",
  "uptime": 120.5,
  "timestamp": "2026-04-14T12:00:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

---

## Auth — `/api/auth`

### POST /api/auth/register
Register a new user. At least one of `email` or `phone` is required.

**Body**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "password": "password123",
  "role": "customer"
}
```
Roles: `customer`, `restaurant_owner`, `delivery`

**Response 201** — user created and auto-verified

<!-- 
### POST /api/auth/verify-otp
Verify OTP after registration.

**Body**
```json
{ "identifier": "john@example.com", "otp": "123456" }
```

**Response 200** — account verified
-->

---

### POST /api/auth/login/password
Login with password.

**Body**
```json
{ "identifier": "john@example.com", "password": "password123", "role": "customer" }
```

**Response 200**
```json
{ "accessToken": "...", "refreshToken": "..." }
```

---

### POST /api/auth/login/otp/request
Request OTP for login.

**Body**
```json
{ "identifier": "john@example.com", "role": "customer" }
```

**Response 200** — OTP sent

---

### POST /api/auth/login/otp/verify
Verify OTP and receive tokens.

**Body**
```json
{ "identifier": "john@example.com", "otp": "123456", "role": "customer" }
```

**Response 200**
```json
{ "accessToken": "...", "refreshToken": "..." }
```

---

### POST /api/auth/refresh
Get a new access token.

**Body**
```json
{ "refreshToken": "..." }
```

**Response 200**
```json
{ "accessToken": "..." }
```

---

### POST /api/auth/logout
Revoke refresh token. Requires authentication.

**Response 200** — logged out

---

## Users — `/api/users`

### GET /api/users/me
Get current user profile. Requires authentication.

**Response 200**
```json
{ "id": 1, "name": "John Doe", "email": "john@example.com", "phone": "...", "role": "customer", "is_verified": true }
```

---

### PATCH /api/users/me
Update profile. Requires authentication.

**Body** (at least one field)
```json
{ "name": "New Name", "password": "newpassword123" }
```

---

### POST /api/users/addresses
Add a delivery address. Requires `customer` role.

**Body**
```json
{ "address": "123 Main St", "lat": 12.9716, "lng": 77.5946 }
```

---

### DELETE /api/users/addresses/:id
Delete an address. Requires `customer` role.

---

## Restaurants — `/api/restaurants`

### GET /api/restaurants
List all restaurants (paginated). Public.

**Query params:** `page`, `limit`

---

### GET /api/restaurants/:id
Get restaurant details with menu grouped by category. Public.

---

### POST /api/restaurants/:id/menu
Add a menu item. Requires `restaurant_owner` role.

**Body**
```json
{ "name": "Burger", "price": 9.99, "category": "Fast Food" }
```

---

### PATCH /api/restaurants/:id/menu/:itemId
Update a menu item. Requires `restaurant_owner` role.

**Body** (at least one field)
```json
{ "price": 11.99, "is_available": false }
```

---

## Orders — `/api/orders`

### POST /api/orders
Create an order. Requires `customer` role.

**Body**
```json
{
  "restaurant_id": 1,
  "address_id": 1,
  "items": [
    { "menu_item_id": 1, "quantity": 2 }
  ]
}
```

**Response 201** — order with status `pending` and computed total

---

### GET /api/orders
Get current customer's orders (paginated). Requires `customer` role.

**Query params:** `page`, `limit`

---

### POST /api/orders/:id/cancel
Cancel an order. Requires `customer` role. Only allowed from `pending` or `confirmed` status.

---

### PATCH /api/orders/:id/status
Update order status. Requires `restaurant_owner` or `delivery` role.

**Body**
```json
{ "status": "confirmed" }
```

Valid statuses: `confirmed`, `preparing`, `out_for_delivery`, `delivered`, `cancelled`

---

## Delivery — `/api/delivery`

### POST /api/delivery/:orderId/accept
Accept a delivery order. Requires `delivery` role.

---

### POST /api/delivery/:orderId/location
Update delivery location. Requires `delivery` role.

**Body**
```json
{ "lat": 12.9716, "lng": 77.5946 }
```

---

### POST /api/delivery/:orderId/complete
Mark order as delivered. Requires `delivery` role.

---

## Payments — `/api/payments`

### POST /api/payments
Create a payment. Requires `customer` role.

**Body**
```json
{ "orderId": 1, "amount": 19.98, "method": "CARD" }
```

Methods: `COD`, `CARD`, `UPI`, `NETBANKING`

---

### POST /api/payments/verify
Verify payment with gateway. Requires `customer` role.

**Body**
```json
{ "paymentId": 1, "success": true }
```

---

### POST /api/payments/:id/refund
Refund a payment. Requires `customer` role. Only allowed when payment is `paid` and order is `cancelled`.

---

## Notifications — `/api/notifications`

### GET /api/notifications
Get current user's notifications (paginated, newest first). Requires authentication.

---

## Admin — `/api/admin`

### POST /api/admin/restaurants/:id/approve
Approve a restaurant. Requires `admin` role.

---

### POST /api/admin/agents/:id/approve
Approve a delivery agent. Requires `admin` role.

---

### GET /api/admin/analytics
Get platform analytics. Requires `admin` role.

**Query params:** `startDate`, `endDate` (ISO 8601)

**Response 200**
```json
{
  "totalOrders": 150,
  "totalRevenue": 2500.00,
  "activeRestaurants": 12,
  "activeAgents": 8
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing/invalid/expired JWT or wrong credentials |
| `FORBIDDEN` | 403 | Unverified user, role mismatch, or ownership violation |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Duplicate email/phone or already-assigned delivery |
| `VALIDATION_ERROR` | 422 | Request body failed schema validation |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled exception |

---

## Socket.IO Events

Connect with JWT in handshake:
```js
const socket = io('http://localhost:3000', { auth: { token: '<accessToken>' } });
```

| Event | Direction | Description |
|---|---|---|
| `order_status_update` | Server → Customer | Fired when order status changes |
| `delivery_location` | Server → Customer | Fired when delivery agent updates location |
| `new_order` | Server → Restaurant Owner | Fired when a new order is placed |
| `new_delivery_request` | Server → All Delivery Agents | Fired when an order is ready for pickup |
