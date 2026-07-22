# Postman API Testing Guide — Food Delivery Backend

---

## ONE-TIME SETUP

### Step A — Create Postman Environment
Environments → Add → name it `Food Delivery`

| Variable       | Value                   |
|----------------|-------------------------|
| `base_url`     | `http://localhost:3000` |
| `access_token` | _(leave empty)_         |
| `refresh_token`| _(leave empty)_         |

---

### Step B — Auto-save tokens script
Paste this in the **Tests** tab of EVERY login request.
It saves tokens automatically so you don't have to copy-paste them.

```js
const res = pm.response.json();
if (res.success) {
  pm.environment.set("access_token", res.data.accessToken);
  pm.environment.set("refresh_token", res.data.refreshToken);
}
```

---

### Step C — How to send a request in Postman
For every POST/PUT/PATCH request:
1. Set method and URL
2. Go to **Body** tab → select **raw** → change dropdown to **JSON**
3. Paste the body JSON
4. For protected routes, go to **Headers** tab and add:
   - Key: `Authorization`
   - Value: `Bearer {{access_token}}`
5. Click **Send**

---

### Step D — Start the server
```bash
cd Backend
npm run dev
```

---

### Step E — User Verification
> Users are now automatically verified upon registration.
> You can login immediately after registering without any additional verification step.

---

## RESPONSE SHAPE

Every response is always one of these two:
```json
{ "success": true,  "message": "...", "data": { } }
{ "success": false, "message": "...", "code": "..." }
```

---

## HEALTH CHECK

```
GET http://localhost:3000/health
```
No auth, no body. Just hit send to confirm server + DB + Redis are running.

---

---

# PHASE 1 — AUTH & USER REGISTRATION

> Follow this exact order. Each step depends on the previous one.

---

## 1A — Register as Restaurant Owner

```
POST {{base_url}}/api/auth/register
```

Body:
```json
{
  "name": "Pizza Owner",
  "phone": "+919876543201",
  "password": "Password123!",
  "role": "restaurant_owner"
}
```

Response `201`:
```json
{ "success": true, "message": "User registered successfully", "data": { "id": "...", "is_verified": true } }
```

> User is automatically verified and can login immediately.

---

## 1B — Login as Restaurant Owner

```
POST {{base_url}}/api/auth/login/password
```

Body:
```json
{ "identifier": "+919876543201", "password": "Password123!", "role": "restaurant_owner" }
```

> Add the Tests tab script here to auto-save tokens.

Response `200`:
```json
{ "success": true, "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." } }
```

---

## 1C — Register as Delivery Agent

```
POST {{base_url}}/api/auth/register
```

Body:
```json
{
  "name": "Delivery Guy",
  "phone": "+919876543202",
  "password": "Password123!",
  "role": "delivery"
}
```

---

## 1D — Login as Delivery Agent

```
POST {{base_url}}/api/auth/login/password
```

Body:
```json
{ "identifier": "+919876543202", "password": "Password123!", "role": "delivery" }
```

> Add the Tests tab script to save tokens.

---

## 1E — Register as Customer

```
POST {{base_url}}/api/auth/register
```

Body:
```json
{
  "name": "John Customer",
  "phone": "+919876543210",
  "password": "Password123!",
  "role": "customer"
}
```

---

## 1F — Login as Customer

```
POST {{base_url}}/api/auth/login/password
```

Body:
```json
{ "identifier": "+919876543210", "password": "Password123!", "role": "customer" }
```

> Add the Tests tab script to save tokens.

---

## 1G — Create Admin User

> `admin` role cannot be registered via API. Do this manually in MongoDB Atlas.

1. Register normally with `role: "customer"` using any email/phone
2. Go to **MongoDB Atlas** → `food_delivery` database → `User` collection
3. Find your user → click Edit → change `role` to `"admin"` → Save

Then login:

```
POST {{base_url}}/api/auth/login/password
```

Body:
```json
{ "identifier": "+919876543200", "password": "Password123!", "role": "admin" }
```

---

## 1H — OTP Login (passwordless alternative)

Use this instead of password login. Works for all roles except admin.

**Step 1 — Request OTP**
```
POST {{base_url}}/api/auth/login/otp/request
```

Body:
```json
{ "identifier": "+919876543210", "role": "customer" }
```

> Check terminal for OTP code. Works same for `restaurant_owner` and `delivery` — just change phone and role.

**Step 2 — Verify OTP and get tokens**
```
POST {{base_url}}/api/auth/login/otp/verify
```

Body:
```json
{ "identifier": "+919876543210", "otp": "482910", "role": "customer" }
```

Response `200`:
```json
{ "success": true, "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." } }
```

> Add the Tests tab script here to auto-save tokens.

---

## 1I — Refresh Token

```
POST {{base_url}}/api/auth/refresh
```

Body:
```json
{ "refreshToken": "{{refresh_token}}" }
```

Response `200`:
```json
{ "success": true, "data": { "accessToken": "eyJ..." } }
```

---

## 1J — Logout

```
POST {{base_url}}/api/auth/logout
```

Headers: `Authorization: Bearer {{access_token}}`

Body:
```json
{ "refreshToken": "{{refresh_token}}" }
```

---

---

# PHASE 2 — SETUP RESTAURANT (as restaurant_owner)

> Login as restaurant_owner first (Step 1B). Use that token.

---

## 2A — Create Restaurant Profile

> First time calling this creates the restaurant. Calling it again updates it.

```
PUT {{base_url}}/api/vendor/profile
```

Headers: `Authorization: Bearer {{access_token}}`

Body:
```json
{
  "name": "Pizza Palace",
  "address": "123 Main St, Mumbai",
  "cuisineType": "Italian",
  "description": "Best pizza in town",
  "minOrderAmount": 10.0,
  "deliveryFee": 2.99
}
```

Response `200`:
```json
{
  "success": true,
  "data": {
    "id": "6610a2f3e4b0c12d3f456789",
    "name": "Pizza Palace",
    "approvalStatus": "pending"
  }
}
```

> Copy the restaurant `id` — needed for admin approval.

---

## 2B — Add Menu Items

```
POST {{base_url}}/api/vendor/menu
```

Headers: `Authorization: Bearer {{access_token}}`

Body:
```json
{
  "name": "Margherita Pizza",
  "price": 9.99,
  "category": "Pizza",
  "description": "Fresh mozzarella and tomato sauce",
  "prepTimeMin": 15,
  "isAvailable": true
}
```

Response `201`:
```json
{
  "success": true,
  "data": { "id": "661abc123def456789012345", "name": "Margherita Pizza", "price": 9.99 }
}
```

> Copy the menu item `id` — needed when placing an order.
> Add 2-3 items from the same restaurant.

---

---

# PHASE 3 — ADMIN APPROVES RESTAURANT

> Login as admin first (Step 1G). Use that token.

---

## 3A — Approve the Restaurant

```
POST {{base_url}}/api/admin/restaurants/6610a2f3e4b0c12d3f456789/approve
```

> Replace `6610a2f3e4b0c12d3f456789` with your actual restaurant id from Step 2A.

Headers: `Authorization: Bearer {{access_token}}`
Body: none

Response `200`:
```json
{ "success": true, "message": "Restaurant approved", "data": { "approvalStatus": "approved" } }
```

---

---

# PHASE 4 — BROWSE & ORDER (as customer)

> Login as customer first (Step 1F). Use that token.

---

## 4A — List Restaurants

```
GET {{base_url}}/api/restaurants
```

No auth, no body.
Optional query params (Params tab): `page=1`, `limit=20`, `category=Pizza`

Response `200`:
```json
{
  "success": true,
  "data": {
    "restaurants": [
      { "id": "6610a2f3e4b0c12d3f456789", "name": "Pizza Palace", "isOpen": true }
    ],
    "total": 1
  }
}
```

> Copy the restaurant `id`.

---

## 4B — Get Restaurant Details + Menu

```
GET {{base_url}}/api/restaurants/6610a2f3e4b0c12d3f456789
```

No auth, no body.

Response `200`:
```json
{
  "success": true,
  "data": {
    "name": "Pizza Palace",
    "menu": {
      "Pizza": [
        { "id": "661abc123def456789012345", "name": "Margherita Pizza", "price": 9.99 }
      ]
    }
  }
}
```

> Copy a menu item `id`.

---

## 4C — Add Delivery Address

```
POST {{base_url}}/api/users/addresses
```

Headers: `Authorization: Bearer {{access_token}}`

Body:
```json
{ "address": "456 Park Ave, Mumbai", "lat": 19.0760, "lng": 72.8777 }
```

Response `201`:
```json
{ "success": true, "data": { "id": "addr_id_here" } }
```

> Copy the address `id`.

---

## 4D — Place an Order

```
POST {{base_url}}/api/orders
```

Headers: `Authorization: Bearer {{access_token}}`

Body:
```json
{
  "restaurant_id": "6610a2f3e4b0c12d3f456789",
  "address_id": "addr_id_here",
  "items": [
    { "menu_item_id": "661abc123def456789012345", "quantity": 2 }
  ]
}
```

Response `201`:
```json
{ "success": true, "data": { "id": "order_id_here", "status": "PENDING", "totalAmount": 19.98 } }
```

> Copy the order `id`.

---

## 4E — Make Payment

```
POST {{base_url}}/api/payments
```

Headers: `Authorization: Bearer {{access_token}}`

Body:
```json
{ "orderId": "order_id_here", "amount": 19.98, "method": "COD" }
```

Response `201`:
```json
{ "success": true, "data": { "payment": { "id": "payment_id_here", "status": "pending" } } }
```

> Copy the payment `id`.

---

## 4F — Verify Payment (mock/test)

```
POST {{base_url}}/api/payments/verify
```

Headers: `Authorization: Bearer {{access_token}}`

Body:
```json
{ "paymentId": "payment_id_here", "success": true }
```

Response `200`:
```json
{ "success": true, "data": { "status": "SUCCESS" } }
```

---

---

# PHASE 5 — RESTAURANT OWNER HANDLES ORDER

> Login as restaurant_owner (Step 1B). Use that token.

---

## 5A — View Incoming Orders

```
GET {{base_url}}/api/vendor/orders/incoming
```

Headers: `Authorization: Bearer {{access_token}}`
Body: none

---

## 5B — Accept the Order

```
POST {{base_url}}/api/vendor/orders/order_id_here/accept
```

Headers: `Authorization: Bearer {{access_token}}`
Body: none

Response `200`:
```json
{ "success": true, "data": { "status": "CONFIRMED" } }
```

---

## 5C — Mark as Preparing

```
POST {{base_url}}/api/vendor/orders/order_id_here/ready
```

Headers: `Authorization: Bearer {{access_token}}`
Body: none

Response `200`:
```json
{ "success": true, "data": { "status": "PREPARING" } }
```

---

---

# PHASE 6 — DELIVERY AGENT HANDLES DELIVERY

> Login as delivery agent (Step 1D). Use that token.

---

## 6A — Go Online

```
POST {{base_url}}/api/delivery/online
```

Headers: `Authorization: Bearer {{access_token}}`
Body: none

---

## 6B — View Available Orders

```
GET {{base_url}}/api/delivery/orders/available
```

Headers: `Authorization: Bearer {{access_token}}`
Body: none

---

## 6C — Accept the Order

```
POST {{base_url}}/api/delivery/order_id_here/accept
```

Headers: `Authorization: Bearer {{access_token}}`
Body: none

Response `200`:
```json
{ "success": true, "data": { "status": "OUT_FOR_DELIVERY" } }
```

---

## 6D — Update Live Location

```
POST {{base_url}}/api/delivery/order_id_here/location
```

Headers: `Authorization: Bearer {{access_token}}`

Body:
```json
{ "latitude": 19.0760, "longitude": 72.8777 }
```

---

## 6E — Complete the Delivery

```
POST {{base_url}}/api/delivery/order_id_here/complete
```

Headers: `Authorization: Bearer {{access_token}}`
Body: none

Response `200`:
```json
{ "success": true, "data": { "status": "DELIVERED" } }
```

---

---

# PHASE 7 — CUSTOMER POST-ORDER

> Login as customer (Step 1F). Use that token.

---

## 7A — View My Orders

```
GET {{base_url}}/api/orders
```

Headers: `Authorization: Bearer {{access_token}}`
Optional Params: `tab=active` or `tab=past`, `page=1`, `limit=20`

---

## 7B — Cancel an Order

> Only works when order status is `PENDING` or `CONFIRMED`

```
POST {{base_url}}/api/orders/order_id_here/cancel
```

Headers: `Authorization: Bearer {{access_token}}`
Body: none

---

## 7C — Refund

> Only works when payment is `SUCCESS` and order is `CANCELLED`

```
POST {{base_url}}/api/payments/payment_id_here/refund
```

Headers: `Authorization: Bearer {{access_token}}`

Body:
```json
{ "reason": "Changed my mind" }
```

---

## 7D — View Notifications

```
GET {{base_url}}/api/notifications
```

Headers: `Authorization: Bearer {{access_token}}`
Optional Params: `page=1`, `limit=10`

---

---

# PHASE 8 — ADMIN

> Login as admin (Step 1G). Use that token.

---

## 8A — Approve Delivery Agent

```
POST {{base_url}}/api/admin/agents/agent_user_id_here/approve
```

Headers: `Authorization: Bearer {{access_token}}`
Body: none

---

## 8B — Analytics

```
GET {{base_url}}/api/admin/analytics
```

Headers: `Authorization: Bearer {{access_token}}`
Params tab: `startDate=2026-01-01`, `endDate=2026-12-31`

Response `200`:
```json
{
  "success": true,
  "data": { "totalOrders": 150, "totalRevenue": 2500.00, "activeRestaurants": 1, "activeAgents": 1 }
}
```

---

## 8C — Approve Store

```
POST {{base_url}}/api/admin/stores/store_id_here/approve
```

Headers: `Authorization: Bearer {{access_token}}`
Body: none

Response `200`:
```json
{ "success": true, "message": "store approved", "data": { } }
```

---

## 8D — Dashboard

```
GET {{base_url}}/api/admin/dashboard
```

Headers: `Authorization: Bearer {{access_token}}`

Response `200`:
```json
{ "success": true, "message": "Admin dashboard retrieved", "data": { } }
```

---

## 8E — Get Pending Restaurants

```
GET {{base_url}}/api/admin/pending-approvals/restaurants
```

Headers: `Authorization: Bearer {{access_token}}`

Response `200`:
```json
{ "success": true, "message": "Pending restaurants retrieved", "data": [] }
```

---

## 8F — Get Pending Delivery Agents

```
GET {{base_url}}/api/admin/pending-approvals/delivery-agents
```

Headers: `Authorization: Bearer {{access_token}}`

Response `200`:
```json
{ "success": true, "message": "Pending delivery agents retrieved", "data": [] }
```

---

## 8G — Get Pending Stores

```
GET {{base_url}}/api/admin/pending-approvals/stores
```

Headers: `Authorization: Bearer {{access_token}}`

Response `200`:
```json
{ "success": true, "message": "Pending stores retrieved", "data": [] }
```

---

---

# PHASE 9 — USER PROFILE & ACCOUNT (as customer/any user)

> Login as customer or any authenticated user.

---

## 9A — Get Profile

```
GET {{base_url}}/api/users/me
```

Headers: `Authorization: Bearer {{access_token}}`

Response `200`:
```json
{
  "success": true,
  "message": "Profile retrieved",
  "data": {
    "id": "...",
    "name": "...",
    "email": "...",
    "phone": "...",
    "role": "...",
    "is_verified": true,
    "walletBalance": 0,
    "unreadNotifications": 0
  }
}
```

---

## 9B — Update Profile

```
PATCH {{base_url}}/api/users/me
```

Headers: `Authorization: Bearer {{access_token}}`

Body:
```json
{
  "name": "New Name",
  "email": "new@example.com"
}
```

Response `200`:
```json
{ "success": true, "message": "Profile updated", "data": { } }
```

---

## 9C — Get Addresses

```
GET {{base_url}}/api/users/addresses
```

Headers: `Authorization: Bearer {{access_token}}`

Response `200`:
```json
{ "success": true, "message": "Addresses retrieved", "data": [] }
```

---

## 9D — Delete Address

```
DELETE {{base_url}}/api/users/addresses/address_id_here
```

Headers: `Authorization: Bearer {{access_token}}`

Response `200`:
```json
{ "success": true, "message": "Address deleted", "data": null }
```

---

## 9E — Add to Favorites

```
POST {{base_url}}/api/users/favorites/restaurant_id_here
```

Headers: `Authorization: Bearer {{access_token}}`

Response `201`:
```json
{ "success": true, "message": "Added to favorites", "data": { } }
```

---

## 9F — Get Favorites

```
GET {{base_url}}/api/users/favorites
```

Headers: `Authorization: Bearer {{access_token}}`

Response `200`:
```json
{ "success": true, "message": "Favorites retrieved", "data": [] }
```

---

## 9G — Remove from Favorites

```
DELETE {{base_url}}/api/users/favorites/restaurant_id_here
```

Headers: `Authorization: Bearer {{access_token}}`

Response `200`:
```json
{ "success": true, "message": "Removed from favorites", "data": null }
```

---

## 9H — Get Wallet

```
GET {{base_url}}/api/users/wallet
```

Headers: `Authorization: Bearer {{access_token}}`

Response `200`:
```json
{ "success": true, "message": "Wallet retrieved", "data": { "balance": 0, "transactions": [] } }
```

---

## 9I — Get Dashboard

```
GET {{base_url}}/api/users/dashboard
```

Headers: `Authorization: Bearer {{access_token}}`

Response `200`:
```json
{ "success": true, "message": "Customer dashboard retrieved", "data": { } }
```

---

---

# SOCKET.IO REAL-TIME

In Postman: **New → Socket.IO** → URL: `{{base_url}}`

Under **Connection → Auth** tab:
```json
{ "token": "{{access_token}}" }
```

| Event | Direction | Who | Payload |
|---|---|---|---|
| `join_order_room` | Client → Server | Customer | `{ "order_id": "..." }` |
| `location:update` | Client → Server | Delivery agent | `{ "order_id": "...", "lat": 19.07, "lng": 72.87 }` |
| `order_status_update` | Server → Client | Customer receives | `{ "order_id": "...", "status": "CONFIRMED" }` |
| `delivery_location` | Server → Client | Customer receives | `{ "order_id": "...", "lat": 19.07, "lng": 72.87 }` |
| `new_delivery_request` | Server → Client | All delivery agents | `{ "order_id": "..." }` |
| `new_order` | Server → Client | Restaurant owner | `{ "order_id": "..." }` |

---

---

# ERROR REFERENCE

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Invalid state — e.g. cancelling a delivered order |
| 401 | `UNAUTHORIZED` | Missing, expired, or invalid JWT |
| 403 | `FORBIDDEN` | Wrong role, unverified account, or ownership violation |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate phone/email, or double-accept on delivery |
| 422 | `VALIDATION_ERROR` | Body failed validation — check `errors` array for field details |
| 429 | `RATE_LIMITED` | Over 100 requests/min from same IP |
| 500 | `INTERNAL_SERVER_ERROR` | Server crashed — check terminal logs |
