# Tasks

## Task List

- [x] 1. Project Scaffolding and Configuration
  - [x] 1.1 Initialize Node.js project with package.json, install all dependencies
  - [x] 1.2 Create folder structure
  - [x] 1.3 Create src/config/env.js
  - [x] 1.4 Create src/config/db.js
  - [x] 1.5 Create src/config/redis.js
  - [x] 1.6 Create src/common/constants/roles.js, orderStatus.js, paymentStatus.js, rbac.js
  - [x] 1.7 Create src/common/utils/response.js
  - [x] 1.8 Create src/common/utils/logger.js
  - [x] 1.9 Create src/common/utils/jwt.js
  - [x] 1.10 Create src/common/utils/otp.js
  - [x] 1.11 Create prisma/schema.prisma
  - [x] 1.12 Create server.js

- [x] 2. Shared Middleware
  - [x] 2.1 Create src/common/middleware/authenticate.js
  - [x] 2.2 Create src/common/middleware/authorize.js
  - [x] 2.3 Create src/common/middleware/validate.js
  - [x] 2.4 Create src/common/middleware/rateLimiter.js
  - [x] 2.5 Create src/common/middleware/errorHandler.js
  - [x] 2.6 Create src/common/utils/AppError.js

- [x] 3. Auth Module
  - [x] 3.1 Create src/modules/auth/validation.js
  - [x] 3.2 Create src/modules/auth/service.js
  - [x] 3.3 Create src/modules/auth/controller.js
  - [x] 3.4 Create src/modules/auth/routes.js

- [x] 4. User Module
  - [x] 4.1 Create src/modules/user/validation.js
  - [x] 4.2 Create src/modules/user/service.js
  - [x] 4.3 Create src/modules/user/controller.js
  - [x] 4.4 Create src/modules/user/routes.js

- [x] 5. Restaurant Module
  - [x] 5.1 Create src/modules/restaurant/validation.js
  - [x] 5.2 Create src/modules/restaurant/service.js
  - [x] 5.3 Create src/modules/restaurant/controller.js
  - [x] 5.4 Create src/modules/restaurant/routes.js

- [x] 6. Order Module
  - [x] 6.1 Create src/modules/order/validation.js
  - [x] 6.2 Create src/modules/order/service.js
  - [x] 6.3 Create src/modules/order/controller.js
  - [x] 6.4 Create src/modules/order/routes.js

- [x] 7. Delivery Module
  - [x] 7.1 Create src/modules/delivery/validation.js
  - [x] 7.2 Create src/modules/delivery/service.js
  - [x] 7.3 Create src/modules/delivery/controller.js
  - [x] 7.4 Create src/modules/delivery/routes.js

- [x] 8. Payment Module
  - [x] 8.1 Create src/modules/payment/validation.js
  - [x] 8.2 Create src/modules/payment/service.js
  - [x] 8.3 Create src/modules/payment/controller.js
  - [x] 8.4 Create src/modules/payment/routes.js

- [x] 9. Notification Module
  - [x] 9.1 Create src/modules/notification/service.js
  - [x] 9.2 Create src/modules/notification/controller.js
  - [x] 9.3 Create src/modules/notification/routes.js

- [x] 10. Admin Module
  - [x] 10.1 Create src/modules/admin/validation.js
  - [x] 10.2 Create src/modules/admin/service.js
  - [x] 10.3 Create src/modules/admin/controller.js
  - [x] 10.4 Create src/modules/admin/routes.js

- [x] 11. Socket.IO Server
  - [x] 11.1 Create src/sockets/index.js
  - [x] 11.2 Create src/sockets/orderHandlers.js
  - [x] 11.3 Create src/sockets/deliveryHandlers.js

- [x] 12. Background Jobs
  - [x] 12.1 Create src/jobs/otpCleanup.js
  - [x] 12.2 Create src/jobs/index.js

- [x] 13. Documentation
  - [x] 13.1 Create ARCHITECTURE.md

- [x] 14. Tests — Unit and Integration
  - [x] 14.1 Configure Jest with test environment, setup/teardown for Prisma test database and Redis test instance
  - [x] 14.2 Write integration tests for auth flows
  - [x] 14.3 Write integration tests for RBAC
  - [x] 14.4 Write integration tests for order lifecycle
  - [x] 14.5 Write integration tests for payment lifecycle
  - [x] 14.6 Write unit tests for response envelope
  - [x] 14.7 Write unit tests for validation middleware

- [x] 16. Live Location Tracking
  - [x] 16.1 Add lat/lng fields to delivery model (Prisma)
  - [x] 16.2 Emit location:update from delivery agent via Socket.IO
  - [x] 16.3 Persist latest rider location in DB
  - [x] 16.4 Emit location updates to customer room
  - [x] 16.5 Join customer to order-specific socket room

- [x] 17. Payment Gateway Integration (Razorpay)
  - [x] 17.1 Install razorpay SDK (npm install razorpay)
  - [x] 17.2 POST /api/payments — creates Razorpay order, returns orderId + keyId for client SDK
  - [x] 17.3 POST /api/payments/verify — validates Razorpay HMAC-SHA256 signature; falls back to mock when keys absent
  - [x] 17.4 Update payment and order status in DB after success/failure
  - [x] 17.5 POST /api/payments/webhook — validates webhook signature, handles payment.captured / payment.failed / refund events
  - [x] 17.6 Add razorpayOrderId, razorpayPaymentId, razorpaySignature fields to Payment model
  - [x] 17.7 Add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET to env config
  - [x] 17.1 Add AgentSession, AgentVehicle, AgentDocument, AgentBankDetail models to Prisma
  - [x] 17.2 Add earnings, deliveryFee, distanceKm, completedAt to DeliveryTracking
  - [x] 17.3 GET /api/delivery/dashboard — total deliveries, earnings (today/week/month/total), avgPerDelivery, online hours, active delivery
  - [x] 17.4 POST /api/delivery/online — go online (start session)
  - [x] 17.5 POST /api/delivery/offline — go offline (end session, calculate duration)
  - [x] 17.6 GET /api/delivery/orders/available — new orders with customerName, itemCount, deliveryFee
  - [x] 17.7 GET /api/delivery/orders/active — active delivery with restaurant + customer address
  - [x] 17.8 GET /api/delivery/orders/history — completed delivery history
  - [x] 17.9 POST /api/delivery/:orderId/reject — reject order
  - [x] 17.10 GET/PUT /api/delivery/profile/vehicle — vehicle details
  - [x] 17.11 GET/PUT /api/delivery/profile/documents/:type — document upload with status
  - [x] 17.12 GET/PUT /api/delivery/profile/bank — bank details

- [x] 18. Cart Module
  - [x] 18.1 Create src/modules/cart/service.js
  - [x] 18.2 Create src/modules/cart/controller.js
  - [x] 18.3 Create src/modules/cart/routes.js
  - [x] 18.4 Add item to cart
  - [x] 18.5 Remove item from cart
  - [x] 18.6 Update item quantity
  - [x] 18.7 Get user cart
  - [x] 18.8 Convert cart to order

- [x] 19. Customer App Features
  - [x] 19.1 Add cuisineType, category, imageUrl, rating, deliveryTime, deliveryFee, latitude, longitude, offerTag, ownerId to Restaurant model
  - [x] 19.2 Add category, imageUrl to MenuItem model
  - [x] 19.3 Add Favorite, SearchHistory, Banner, Wallet, WalletTransaction models to Prisma
  - [x] 19.4 GET /api/restaurants/categories — food category list for home screen
  - [x] 19.5 GET /api/restaurants/banners — promotional banners
  - [x] 19.6 GET /api/restaurants/search?q= — search restaurants and dishes, saves to history
  - [x] 19.7 GET/DELETE /api/restaurants/search/history — recent searches with clear all
  - [x] 19.8 GET /api/restaurants?category= — filter restaurants by category
  - [x] 19.9 GET /api/users/favorites — my favorite restaurants
  - [x] 19.10 POST/DELETE /api/users/favorites/:restaurantId — add/remove favorite
  - [x] 19.11 GET /api/users/wallet — wallet balance + transaction history
  - [x] 19.12 GET /api/users/addresses — list saved addresses
  - [x] 19.13 GET /api/users/me — profile now includes walletBalance and unreadNotifications count
  - [x] 19.14 GET /api/orders?tab=active|past — active/past order tabs

- [x] 20. Vendor (Restaurant Owner) Dashboard
  - [x] 20.1 Add email, phone, bannerUrl, workingHours to Restaurant model
  - [x] 20.2 Add originalPrice, prepTimeMin, rating, soldCount to MenuItem model
  - [x] 20.3 Add orderNumber, isDelayed to Order model
  - [x] 20.4 GET /api/vendor/dashboard — today's orders, earnings, active orders, completion rate, weekly chart
  - [x] 20.5 GET /api/vendor/orders/incoming — pending orders with customer name, phone, address, items
  - [x] 20.6 GET /api/vendor/orders/active — confirmed/preparing orders
  - [x] 20.7 GET /api/vendor/orders/completed — delivered orders history
  - [x] 20.8 POST /api/vendor/orders/:id/accept — accept order
  - [x] 20.9 POST /api/vendor/orders/:id/reject — reject order
  - [x] 20.10 POST /api/vendor/orders/:id/ready — mark order as preparing/ready
  - [x] 20.11 POST /api/vendor/orders/:id/delay — mark order as delayed
  - [x] 20.12 POST /api/vendor/orders/accept-all — accept all pending orders
  - [x] 20.13 GET/PUT /api/vendor/profile — restaurant profile with working hours
  - [x] 20.14 POST /api/vendor/profile/toggle-open — toggle open/closed status
  - [x] 20.15 GET /api/vendor/menu — menu list with category filter, search, availableOnly toggle
  - [x] 20.16 POST /api/vendor/menu — add menu item
  - [x] 20.17 PUT /api/vendor/menu/:itemId — update menu item
  - [x] 20.18 PATCH /api/vendor/menu/:itemId/toggle — hide/show menu item
  - [x] 20.19 DELETE /api/vendor/menu/:itemId — delete menu item

- [x] 15. Tests — Property-Based
  - [x] 15.1 Write PBT for Property 1: Registration always creates is_verified=false, status=active
  - [x] 15.2 Write PBT for Property 2: Duplicate email or phone always returns 409
  - [x] 15.3 Write PBT for Property 3: OTP round-trip
  - [x] 15.4 Write PBT for Property 4: Unverified user always blocked
  - [x] 15.5 Write PBT for Property 5: Login JWT always contains correct claims
  - [x] 15.6 Write PBT for Property 6: Role mismatch at login always returns 403
  - [x] 15.7 Write PBT for Property 7: Refresh token always preserves role claim
  - [x] 15.8 Write PBT for Property 8: Post-logout refresh always returns 401
  - [x] 15.9 Write PBT for Property 9: Invalid JWT always rejected
  - [x] 15.10 Write PBT for Property 10: Profile GET/PATCH round-trip always consistent
  - [x] 15.11 Write PBT for Property 11: Address delete by non-owner always returns 403
  - [x] 15.12 Write PBT for Property 12: Address add/delete round-trip always consistent
  - [x] 15.13 Write PBT for Property 13: Pagination invariants
  - [x] 15.14 Write PBT for Property 14: Menu always grouped by category
  - [x] 15.15 Write PBT for Property 15: Non-owner menu operations always return 403
  - [x] 15.16 Write PBT for Property 16: Menu item add/update round-trip always consistent
  - [x] 15.17 Write PBT for Property 17: Order creation always sets pending status with correct total
  - [x] 15.18 Write PBT for Property 18: Cross-restaurant item always returns 400

  - [x] 15.19 Write PBT for Property 19: Cancellation state machine always enforced
  - [x] 15.20 Write PBT for Property 20: Order list always isolated to requesting customer
  - [x] 15.21 Write PBT for Property 21: Status update always emits socket event
  - [x] 15.22 Write PBT for Property 22: Delivery acceptance assigns agent; double-accept always 409
  - [x] 15.23 Write PBT for Property 23: Location update always persists and emits to customer
  - [x] 15.24 Write PBT for Property 24: Order completion always sets delivered
  - [x] 15.25 Write PBT for Property 25: Payment lifecycle always transitions correctly
  - [x] 15.26 Write PBT for Property 26: Refund eligibility always enforced
  - [x] 15.27 Write PBT for Property 27: Notification round-trip always stores required fields
  - [x] 15.28 Write PBT for Property 28: Socket events always isolated to correct user rooms
  - [x] 15.29 Write PBT for Property 29: new_delivery_request always broadcast to all delivery agents
  - [x] 15.30 Write PBT for Property 30: RBAC always returns 403 for wrong-role requests
  - [x] 15.31 Write PBT for Property 31: Response envelope always matches success/error shape
  - [x] 15.32 Write PBT for Property 32: Validation failure always returns 422 with field errors
  - [x] 15.33 Write PBT for Property 33: Rate limiting always rejects beyond 100 req/min per IP
  - [x] 15.34 Write PBT for Property 34: Analytics always returns correct aggregates for date range
