'use strict';

require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const { createApp } = require('../__helpers__/testApp');
const { cleanDatabase, disconnectPrisma, prisma } = require('../__helpers__/factories');
const { signAccessToken } = require('../../src/common/utils/jwt');
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

describe('Grocery Stock Lifecycle Integration Tests', () => {
  let customer, seller, store, product1, product2, address;

  beforeEach(async () => {
    // 1. Create a customer and seller user
    customer = await prisma.user.create({
      data: { name: 'Customer User', phone: '+19998887771', role: 'customer', is_verified: true },
    });
    seller = await prisma.user.create({
      data: { name: 'Seller User', phone: '+19998887772', role: 'restaurant_owner', is_verified: true },
    });

    // 2. Create customer address
    address = await prisma.address.create({
      data: {
        userId: customer.id,
        line1: '123 Test Lane',
        city: 'Metroville',
        state: 'CA',
        pincode: '90001',
        latitude: 37.7749,
        longitude: -122.4194,
      },
    });

    // 3. Create grocery store (approvalStatus: approved)
    store = await prisma.store.create({
      data: {
        ownerId: seller.id,
        storeType: 'GROCERY',
        name: 'Super Grocer',
        address: 'Grocery Lane 101',
        approvalStatus: 'approved',
        isOpen: true,
      },
    });

    // 4. Create products
    product1 = await prisma.groceryProduct.create({
      data: {
        storeId: store.id,
        name: 'Fresh Milk',
        price: 2.99,
        stock: 10,
        isAvailable: true,
      },
    });

    product2 = await prisma.groceryProduct.create({
      data: {
        storeId: store.id,
        name: 'Whole Grain Bread',
        price: 3.49,
        stock: 5,
        isAvailable: true,
      },
    });
  });

  it('should deduct stock and increment soldCount when a grocery order is placed', async () => {
    const token = signAccessToken({ id: customer.id, phone: customer.phone, role: 'customer' });
    
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        store_id: store.id,
        store_type: 'grocery',
        address_id: address.id,
        items: [
          { item_id: product1.id, quantity: 3 },
          { item_id: product2.id, quantity: 2 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verify stock and soldCount are updated
    const updatedProduct1 = await prisma.groceryProduct.findUnique({ where: { id: product1.id } });
    const updatedProduct2 = await prisma.groceryProduct.findUnique({ where: { id: product2.id } });

    expect(updatedProduct1.stock).toBe(7);
    expect(updatedProduct1.soldCount).toBe(3);
    expect(updatedProduct2.stock).toBe(3);
    expect(updatedProduct2.soldCount).toBe(2);
  });

  it('should auto-disable a product (isAvailable: false) when stock reaches 0 after order placement', async () => {
    const token = signAccessToken({ id: customer.id, phone: customer.phone, role: 'customer' });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        store_id: store.id,
        store_type: 'grocery',
        address_id: address.id,
        items: [{ item_id: product2.id, quantity: 5 }], // fully depletes product2 stock (5)
      });

    expect(res.status).toBe(201);

    const updatedProduct2 = await prisma.groceryProduct.findUnique({ where: { id: product2.id } });
    expect(updatedProduct2.stock).toBe(0);
    expect(updatedProduct2.isAvailable).toBe(false);
  });

  it('should reject order creation if requested quantity exceeds stock', async () => {
    const token = signAccessToken({ id: customer.id, phone: customer.phone, role: 'customer' });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        store_id: store.id,
        store_type: 'grocery',
        address_id: address.id,
        items: [{ item_id: product2.id, quantity: 6 }], // exceeds stock of 5
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('units of Whole Grain Bread are available');
  });

  it('should restore stock and decrement soldCount when a grocery order is cancelled', async () => {
    // 1. Create order
    const token = signAccessToken({ id: customer.id, phone: customer.phone, role: 'customer' });
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        store_id: store.id,
        store_type: 'grocery',
        address_id: address.id,
        items: [{ item_id: product2.id, quantity: 5 }],
      });
    
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.id;

    // Verify stock is 0 and isAvailable is false
    let p2 = await prisma.groceryProduct.findUnique({ where: { id: product2.id } });
    expect(p2.stock).toBe(0);
    expect(p2.isAvailable).toBe(false);

    // 2. Cancel order
    const cancelRes = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(cancelRes.status).toBe(200);

    // Verify stock is restored to 5 and isAvailable is auto-enabled back to true
    p2 = await prisma.groceryProduct.findUnique({ where: { id: product2.id } });
    expect(p2.stock).toBe(5);
    expect(p2.isAvailable).toBe(true);
    expect(p2.soldCount).toBe(0);
  });

  it('should restore stock on payment verification failure', async () => {
    // 1. Create order
    const token = signAccessToken({ id: customer.id, phone: customer.phone, role: 'customer' });
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        store_id: store.id,
        store_type: 'grocery',
        address_id: address.id,
        items: [{ item_id: product1.id, quantity: 4 }],
      });

    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.id;

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        orderId,
        amount: 11.96,
        status: 'PENDING',
        reference: 'mock-ref-123',
      },
    });

    // Verify stock is 6
    let p1 = await prisma.groceryProduct.findUnique({ where: { id: product1.id } });
    expect(p1.stock).toBe(6);

    // 2. Verify payment as FAILED
    const verifyRes = await request(app)
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentId: payment.id,
        success: false, // forces failure in mock verification
      });

    expect(verifyRes.status).toBe(200);

    // Verify stock restored to 10
    p1 = await prisma.groceryProduct.findUnique({ where: { id: product1.id } });
    expect(p1.stock).toBe(10);
  });
});
