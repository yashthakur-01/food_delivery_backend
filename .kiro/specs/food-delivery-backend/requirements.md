# Requirements Document

## Introduction

A full-featured Node.js backend for a food delivery platform supporting customers, restaurant owners, delivery agents, and administrators. The system handles user authentication, restaurant and menu management, order lifecycle, real-time delivery tracking via Socket.IO, payment processing, push notifications, and admin oversight. The architecture follows a modular structure under `src/modules/` with shared utilities, socket handlers, background jobs, and a single entry point at `server.js`.

## Glossary

- **System**: The food delivery backend application
- **Auth_Service**: The module responsible for registration, login, OTP verification, token management, and logout
- **User_Service**: The module responsible for profile management and address management
- **Restaurant_Service**: The module responsible for restaurant listing, details, and menu management
- **Order_Service**: The module responsible for order creation, cancellation, status updates, and retrieval
- **Delivery_Service**: The module responsible for delivery agent assignment, location updates, and order completion
- **Payment_Service**: The module responsible for payment creation, verification, and refunds
- **Notification_Service**: The module responsible for sending and retrieving push notifications
- **Admin_Service**: The module responsible for restaurant approval, delivery agent approval, and analytics
- **Socket_Server**: The Socket.IO server responsible for real-time event broadcasting
- **Customer**: A user with role `customer` who places orders
- **Restaurant_Owner**: A user with role `restaurant_owner` who manages restaurants and menus
- **Delivery_Agent**: A user with role `delivery` who accepts and fulfills deliveries
- **Admin**: A user with role `admin` who manages platform operations
- **JWT**: JSON Web Token used for stateless authentication
- **OTP**: One-time password sent via SMS or email for identity verification
- **Identifier**: Either a phone number or email address used to identify a user during login or OTP flows
- **Order_Status**: One of `pending`, `confirmed`, `preparing`, `out_for_delivery`, `delivered`, `cancelled`
- **Payment_Status**: One of `pending`, `paid`, `failed`, `refunded`
- **Maps_Service**: The Google Maps Directions API used to calculate routes between two geographic coordinates
- **Route_Data**: The computed route information returned by the Maps_Service, consisting of an encoded polyline, distance in meters, and duration in seconds

---

## Requirements

### Requirement 1: User Registration and Verification

**User Story:** As a new user, I want to register with my full name, email, phone number, and password, then verify my identity via OTP, so that I can access the platform securely under the correct role.

#### Acceptance Criteria

1. WHEN a registration request is received with `full_name`, `email`, `phone`, `password`, and `role` (one of `customer`, `restaurant_owner`, `delivery`), THE Auth_Service SHALL create a new user record with `is_verified = false` and `status = active`. At least one of `email` or `phone` must be provided.
2. WHEN a registration request is received with an email or phone that already exists, THE Auth_Service SHALL return a 409 Conflict error with a descriptive message.
3. WHEN a user registers successfully, THE Auth_Service SHALL send a 6-digit OTP to the provided email or phone (email preferred if both supplied).
4. WHEN an OTP verification request is received with a valid identifier (phone or email) and matching OTP within 5 minutes of issuance, THE Auth_Service SHALL set `is_verified = true` on the user record.
5. IF an OTP verification request is received with an expired or invalid OTP, THEN THE Auth_Service SHALL return a 400 error with a descriptive message.
6. WHILE a user has `is_verified = false`, THE System SHALL reject requests to protected endpoints with a 403 error.

---

### Requirement 2: Authentication and Session Management

**User Story:** As a registered user, I want to log in using either my phone or email — with either a password or OTP — and maintain a session using tokens, so that I can make authenticated API calls scoped to my role.

#### Acceptance Criteria

1. WHEN a password-login request is received with a valid identifier (phone or email), password, and role, THE Auth_Service SHALL verify that the provided role matches the role stored on the user record.
2. WHEN an OTP-login request is received (step 1), THE Auth_Service SHALL look up the user by identifier and role, generate a 6-digit OTP, and send it to the identifier.
3. WHEN an OTP-login verify request is received (step 2) with a valid identifier, OTP, and role, THE Auth_Service SHALL verify the OTP and issue tokens. If the user is not yet verified, THE Auth_Service SHALL mark them as verified at this point.
4. IF a login request is received where the provided role does not match the stored role, THEN THE Auth_Service SHALL return a 403 error with the message "Role mismatch".
5. WHEN a login request passes all validation, THE Auth_Service SHALL return a signed JWT access token (expiry: 15 minutes) and a refresh token (expiry: 7 days), where the JWT payload includes the user's `id`, `phone`, `email`, `role`, and `is_verified` claims.
6. IF a login request is received with an incorrect password or unregistered identifier, THEN THE Auth_Service SHALL return a 401 error.
7. WHEN a refresh token request is received with a valid, non-expired refresh token, THE Auth_Service SHALL return a new access token containing the same `role` claim as the original token.
8. IF a refresh token request is received with an expired or revoked refresh token, THEN THE Auth_Service SHALL return a 401 error.
9. WHEN a logout request is received with a valid access token, THE Auth_Service SHALL revoke the associated refresh token.
10. THE System SHALL validate the JWT signature, expiry, and `role` claim on every protected endpoint before processing the request.

---

### Requirement 3: User Profile and Address Management

**User Story:** As a logged-in user, I want to manage my profile and saved addresses, so that I can keep my information up to date and speed up checkout.

#### Acceptance Criteria

1. WHEN a get-profile request is received from an authenticated user, THE User_Service SHALL return the user's full name, email, phone, role, and verification status.
2. WHEN an update-profile request is received with valid fields (name, password), THE User_Service SHALL persist the changes and return the updated profile.
3. WHEN an add-address request is received with lat, lng, and address string, THE User_Service SHALL create a new address record linked to the authenticated user.
4. WHEN a delete-address request is received for an address that belongs to the authenticated user, THE User_Service SHALL remove the address record.
5. IF a delete-address request is received for an address that does not belong to the authenticated user, THEN THE User_Service SHALL return a 403 error.

---

### Requirement 4: Restaurant Discovery and Details

**User Story:** As a customer, I want to browse available restaurants and view their menus, so that I can choose where to order from.

#### Acceptance Criteria

1. WHEN a list-restaurants request is received, THE Restaurant_Service SHALL return a paginated list of restaurants with id, name, rating, and `is_open` status.
2. WHEN a get-restaurant-details request is received with a valid restaurant id, THE Restaurant_Service SHALL return the restaurant's full profile including its complete menu grouped by category.
3. IF a get-restaurant-details request is received with a non-existent restaurant id, THEN THE Restaurant_Service SHALL return a 404 error.
4. WHILE a restaurant has `is_open = false`, THE Restaurant_Service SHALL include the restaurant in listings but mark it as closed.

---

### Requirement 5: Menu Management

**User Story:** As a restaurant owner, I want to add and update menu items, so that customers see accurate offerings and prices.

#### Acceptance Criteria

1. WHEN an add-menu-item request is received from an authenticated Restaurant_Owner for a restaurant they own, THE Restaurant_Service SHALL create a new menu item with name, price, and category.
2. WHEN an update-menu-item request is received from an authenticated Restaurant_Owner for an item in their restaurant, THE Restaurant_Service SHALL persist the updated fields.
3. IF an add-menu-item or update-menu-item request is received from a user who does not own the target restaurant, THEN THE Restaurant_Service SHALL return a 403 error.
4. IF an update-menu-item request is received with a non-existent item id, THEN THE Restaurant_Service SHALL return a 404 error.

---

### Requirement 6: Order Lifecycle

**User Story:** As a customer, I want to place, track, and cancel orders, so that I have full control over my purchases.

#### Acceptance Criteria

1. WHEN a create-order request is received with a valid restaurant id, list of item ids with quantities, and delivery address, THE Order_Service SHALL create an order with `status = pending` and `payment_status = pending`, then return the order id and total.
2. IF a create-order request references a menu item that does not belong to the specified restaurant, THEN THE Order_Service SHALL return a 400 error.
3. WHEN a cancel-order request is received for an order with `status = pending` or `status = confirmed`, THE Order_Service SHALL set `status = cancelled`.
4. IF a cancel-order request is received for an order with `status = preparing`, `out_for_delivery`, or `delivered`, THEN THE Order_Service SHALL return a 400 error with a reason.
5. WHEN a get-orders request is received from an authenticated Customer, THE Order_Service SHALL return a paginated list of that customer's orders with status and total.
6. WHEN an update-order-status request is received from an authenticated Restaurant_Owner or Delivery_Agent with a valid next status, THE Order_Service SHALL update the order status and emit an `order_status_update` Socket.IO event to the customer.

---

### Requirement 7: Delivery Management

**User Story:** As a delivery agent, I want to accept delivery requests, update my location, and mark orders complete, so that customers receive their food.

#### Acceptance Criteria

1. WHEN a new order reaches `status = confirmed`, THE Delivery_Service SHALL emit a `new_delivery_request` Socket.IO event to available Delivery_Agents.
2. WHEN an accept-order request is received from an authenticated Delivery_Agent for an unassigned order, THE Delivery_Service SHALL assign the agent to the order and update `status = out_for_delivery`.
3. IF an accept-order request is received for an order already assigned to another agent, THEN THE Delivery_Service SHALL return a 409 error.
4. WHEN an update-location request is received from an authenticated Delivery_Agent with lat, lng, and order id, THE Delivery_Service SHALL persist the location record and emit a `delivery_location` Socket.IO event to the customer.
5. WHEN a complete-order request is received from the assigned Delivery_Agent, THE Delivery_Service SHALL set `status = delivered` and emit an `order_status_update` event to the customer.

---

### Requirement 8: Payment Processing

**User Story:** As a customer, I want to pay for my order and receive refunds on cancellations, so that transactions are handled reliably.

#### Acceptance Criteria

1. WHEN a create-payment request is received with a valid order id and payment method, THE Payment_Service SHALL create a payment record with `status = pending` and return a payment reference.
2. WHEN a verify-payment request is received with a valid payment reference and successful gateway confirmation, THE Payment_Service SHALL set payment `status = paid` and update the order's `payment_status = paid`.
3. IF a verify-payment request is received with a failed gateway confirmation, THEN THE Payment_Service SHALL set payment `status = failed` and update the order's `payment_status = failed`.
4. WHEN a refund request is received for an order with `payment_status = paid` and `status = cancelled`, THE Payment_Service SHALL initiate a refund and set payment `status = refunded`.
5. IF a refund request is received for an order that does not have `payment_status = paid`, THEN THE Payment_Service SHALL return a 400 error.

---

### Requirement 9: Push Notifications

**User Story:** As a user, I want to receive push notifications for order and delivery updates, so that I stay informed without polling the API.

#### Acceptance Criteria

1. WHEN an order status changes, THE Notification_Service SHALL send a push notification to the customer associated with the order containing the new status.
2. WHEN a new delivery request is available, THE Notification_Service SHALL send a push notification to all available Delivery_Agents.
3. WHEN a get-notifications request is received from an authenticated user, THE Notification_Service SHALL return a paginated list of that user's notifications ordered by most recent first.
4. THE Notification_Service SHALL store each notification with user_id, message, type, and read status.

---

### Requirement 10: Admin Operations

**User Story:** As an admin, I want to approve restaurants and delivery agents and view analytics, so that I can maintain platform quality and monitor performance.

#### Acceptance Criteria

1. WHEN an approve-restaurant request is received from an authenticated Admin for a pending restaurant, THE Admin_Service SHALL set the restaurant's approval status to approved.
2. WHEN an approve-delivery-agent request is received from an authenticated Admin for a pending agent, THE Admin_Service SHALL set the agent's status to active.
3. WHEN an analytics request is received from an authenticated Admin, THE Admin_Service SHALL return total orders, total revenue, active restaurants count, and active delivery agents count for a specified date range.
4. IF any Admin endpoint is accessed by a non-Admin user, THEN THE System SHALL return a 403 error.

---

### Requirement 11: Real-Time Socket.IO Communication

**User Story:** As a user, I want real-time updates pushed to my client, so that I see order and delivery changes instantly without refreshing.

#### Acceptance Criteria

1. WHEN a client connects to the Socket_Server with a valid JWT, THE Socket_Server SHALL authenticate the connection and associate the socket with the user's id.
2. IF a client connects to the Socket_Server with an invalid or missing JWT, THEN THE Socket_Server SHALL reject the connection with an authentication error.
3. WHEN an `order_status_update` event is triggered, THE Socket_Server SHALL emit the event only to the socket associated with the relevant customer.
4. WHEN a `delivery_location` event is triggered, THE Socket_Server SHALL emit the event only to the socket associated with the relevant customer.
5. WHEN a `new_order` event is triggered for a restaurant, THE Socket_Server SHALL emit the event only to the socket associated with the relevant Restaurant_Owner.
6. WHEN a `new_delivery_request` event is triggered, THE Socket_Server SHALL emit the event to all sockets associated with available Delivery_Agents.

---

### Requirement 12: Role-Based Access Control

**User Story:** As a platform operator, I want role enforcement to begin at login and apply to every API endpoint, so that users can only perform actions appropriate to their role.

#### Acceptance Criteria

1. WHEN a user logs in, THE Auth_Service SHALL embed the validated `role` claim in the JWT so that role enforcement is established at the point of authentication.
2. THE System SHALL extract the `role` claim from the JWT on every protected request and pass it to the RBAC middleware before routing the request.
3. THE System SHALL support four roles: `customer`, `restaurant_owner`, `delivery`, and `admin`.
4. THE System SHALL enforce that only `customer` can access order creation, order cancellation, address management, and payment endpoints.
5. THE System SHALL enforce that only `restaurant_owner` can access menu management and order status update endpoints.
6. THE System SHALL enforce that only `delivery` can access delivery acceptance, location update, and order completion endpoints.
7. THE System SHALL enforce that only `admin` can access restaurant approval, delivery agent approval, and analytics endpoints.
8. IF a request is received for a role-restricted endpoint from a user whose JWT `role` claim does not match the required role, THEN THE System SHALL return a 403 error with a message indicating the required role(s).
9. THE System SHALL apply RBAC middleware after JWT validation on every protected route so that a missing or tampered `role` claim results in a 403 error.
10. THE System SHALL block any request from a user with `is_verified = false` on all protected endpoints with a 403 error.

---

### Requirement 13: API Consistency and Error Handling

**User Story:** As a frontend developer, I want consistent API response shapes and meaningful error messages, so that I can integrate reliably.

#### Acceptance Criteria

1. THE System SHALL return all successful responses in the shape `{ success: true, data: <payload> }`.
2. THE System SHALL return all error responses in the shape `{ success: false, error: { code: <string>, message: <string> } }`.
3. WHEN an unhandled exception occurs, THE System SHALL log the error with stack trace and return a 500 response without exposing internal details to the client.
4. WHEN a request body fails validation, THE System SHALL return a 422 error listing each invalid field and the reason.
5. THE System SHALL apply rate limiting of 100 requests per minute per IP on all authentication endpoints.

---

### Requirement 14: Architecture and Documentation

**User Story:** As a developer joining the project, I want clear folder structure documentation, so that I can navigate and contribute to the codebase quickly.

#### Acceptance Criteria

1. THE System SHALL include a documentation file at the project root (`ARCHITECTURE.md`) that describes the purpose of each folder under `src/`.
2. THE System SHALL organize all business logic into modules under `src/modules/`, each containing its own routes, controller, service, and validation files.
3. THE System SHALL place all shared middleware (auth, role guard, error handler, rate limiter) under `src/common/middleware/`.
4. THE System SHALL place all Socket.IO event handlers under `src/sockets/`.
5. THE System SHALL place all background/scheduled jobs (e.g., OTP expiry cleanup) under `src/jobs/`.

---

### Requirement 15: Route Calculation via Google Maps Directions API

**User Story:** As a customer, I want to see the delivery agent's route, estimated distance, and ETA in real time, so that I can accurately anticipate when my order will arrive.

#### Acceptance Criteria

1. WHEN an update-location request is received from an authenticated Delivery_Agent with `lat`, `lng`, and `order_id`, THE Delivery_Service SHALL retrieve the delivery address coordinates (lat/lng) from the Order's associated Address record.
2. WHEN the delivery address coordinates are retrieved, THE Delivery_Service SHALL call the Google Maps Directions API with the agent's current position as the origin and the delivery address as the destination.
3. WHEN the Google Maps Directions API returns a successful response, THE Delivery_Service SHALL extract the encoded polyline, `distance_meters`, and `duration_seconds` from the first route's first leg.
4. WHEN route data is extracted, THE Delivery_Service SHALL emit the `delivery_location` Socket.IO event to the customer with the payload `{ lat, lng, polyline, distance_meters, duration_seconds }`.
5. IF the Google Maps Directions API returns an error or times out, THEN THE Delivery_Service SHALL emit the `delivery_location` event with only `{ lat, lng }` and SHALL log the API error, so that location tracking continues uninterrupted.
6. THE System SHALL store the Google Maps API key exclusively in the `GOOGLE_MAPS_API_KEY` environment variable, loaded via `src/config/env.js`, and SHALL NOT include the key in any client-facing response or Socket.IO event payload.
7. WHERE the `GOOGLE_MAPS_API_KEY` environment variable is not set, THE Delivery_Service SHALL skip the Google Maps API call and emit the `delivery_location` event with only `{ lat, lng }`.
8. THE Delivery_Service SHALL act as the sole proxy to the Google Maps Directions API so that the API key is never transmitted to or accessible by the client.
