'use strict';

const prisma = require('../../config/db');
const AppError = require('../../common/utils/AppError');
const ORDER_STATUS = require('../../common/constants/orderStatus');

/**
 * Get or create the cart for a user, including items with menu details.
 */
async function getCart(userId) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: { menuItem: true, groceryProduct: true },
      },
    },
  });

  if (!cart) return { items: [], total: 0, restaurantId: null, storeId: null };

  const total = cart.items.reduce((sum, i) => {
    const price = i.menuItem ? i.menuItem.price : (i.groceryProduct ? i.groceryProduct.price : 0);
    return sum + price * i.quantity;
  }, 0);
  return { ...cart, total };
}

/**
 * Add an item to the cart. If the cart already has items from a different
 * restaurant, throw 400. If the item already exists, increment quantity.
 */
async function addItem(userId, { item_id, store_type, quantity }) {
  let sellerItem;
  if (store_type === 'restaurant') {
    sellerItem = await prisma.menuItem.findUnique({ where: { id: item_id } });
  } else if (store_type === 'grocery') {
    sellerItem = await prisma.groceryProduct.findUnique({ where: { id: item_id } });
  }
  if (!sellerItem) throw new AppError(404, 'NOT_FOUND', 'Item not found');

  let cart = await prisma.cart.findUnique({ where: { userId } });

  if (cart) {
    if (store_type === 'restaurant') {
      if (cart.storeId) throw new AppError(400, 'CART_CONFLICT', 'Cart already has items from a grocery store. Clear cart first.');
      if (cart.restaurantId && cart.restaurantId !== sellerItem.restaurantId) throw new AppError(400, 'CART_CONFLICT', 'Cart already has items from a different restaurant. Clear cart first.');
    } else if (store_type === 'grocery') {
      if (cart.restaurantId) throw new AppError(400, 'CART_CONFLICT', 'Cart already has items from a restaurant. Clear cart first.');
      if (cart.storeId && cart.storeId !== sellerItem.storeId) throw new AppError(400, 'CART_CONFLICT', 'Cart already has items from a different store. Clear cart first.');
    }
  }

  if (!cart) {
    const data = { userId };
    if (store_type === 'restaurant') data.restaurantId = sellerItem.restaurantId;
    if (store_type === 'grocery') data.storeId = sellerItem.storeId;
    cart = await prisma.cart.create({ data });
  } else if (!cart.restaurantId && !cart.storeId) {
    const data = {};
    if (store_type === 'restaurant') data.restaurantId = sellerItem.restaurantId;
    if (store_type === 'grocery') data.storeId = sellerItem.storeId;
    cart = await prisma.cart.update({
      where: { id: cart.id },
      data,
    });
  }

  const whereClause = { cartId: cart.id };
  if (store_type === 'restaurant') whereClause.menuItemId = item_id;
  if (store_type === 'grocery') whereClause.groceryProductId = item_id;

  const existing = await prisma.cartItem.findFirst({
    where: whereClause,
  });

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  } else {
    await prisma.cartItem.create({
      data: { ...whereClause, quantity },
    });
  }

  return getCart(userId);
}

/**
 * Remove a specific item from the cart. Clears restaurantId if cart becomes empty.
 */
async function removeItem(userId, cartItemId) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new AppError(404, 'NOT_FOUND', 'Cart not found');

  const item = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cartId: cart.id },
  });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Cart item not found');

  await prisma.cartItem.delete({ where: { id: cartItemId } });

  const remaining = await prisma.cartItem.count({ where: { cartId: cart.id } });
  if (remaining === 0) {
    await prisma.cart.update({ where: { id: cart.id }, data: { restaurantId: null, storeId: null } });
  }

  return getCart(userId);
}

/**
 * Update the quantity of a cart item. Quantity must be >= 1.
 */
async function updateItemQuantity(userId, cartItemId, quantity) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new AppError(404, 'NOT_FOUND', 'Cart not found');

  const item = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cartId: cart.id },
  });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Cart item not found');

  await prisma.cartItem.update({ where: { id: cartItemId }, data: { quantity } });

  return getCart(userId);
}

/**
 * Clear all items from the cart.
 */
async function clearCart(userId) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) return;

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.cart.update({ where: { id: cart.id }, data: { restaurantId: null, storeId: null } });
}

/**
 * Convert the cart to an order. Requires an addressId.
 * Clears the cart on success.
 */
async function checkoutCart(userId, addressId) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { menuItem: true } } },
  });

  if (!cart || cart.items.length === 0) {
    throw new AppError(400, 'EMPTY_CART', 'Cart is empty');
  }

  const total = cart.items.reduce((sum, i) => sum + i.menuItem.price * i.quantity, 0);

  const order = await prisma.order.create({
    data: {
      userId,
      restaurantId: cart.restaurantId,
      status: ORDER_STATUS.PENDING,
      totalAmount: total,
      items: {
        create: cart.items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          price: i.menuItem.price,
        })),
      },
    },
    include: { items: true },
  });

  await clearCart(userId);

  return order;
}

module.exports = { getCart, addItem, removeItem, updateItemQuantity, clearCart, checkoutCart };
