'use strict';

const prisma = require('../../config/db');
const AppError = require('../../common/utils/AppError');
const ORDER_STATUS = require('../../common/constants/orderStatus');

/**
 * Get the cart for a user, including all items and menu/grocery product details.
 * Calculates the total cost of all items currently in the cart.
 *
 * @param {string} userId - The ID of the user whose cart is being fetched.
 * @returns {Promise<Object>} An object containing the cart items, total amount, and the associated store/restaurant ID.
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
 * Add a new item to the cart or increment its quantity if it already exists.
 * Implements strict conflict validation to ensure the cart only contains items from a single seller 
 * (either a single restaurant or a single grocery store).
 *
 * @param {string} userId - The ID of the user adding the item.
 * @param {Object} payload - The item details payload.
 * @param {string} payload.item_id - The ID of the menu item or grocery product to add.
 * @param {string} payload.store_type - The type of store ('restaurant' or 'grocery').
 * @param {number} payload.quantity - The quantity to add.
 * @returns {Promise<Object>} The updated cart with freshly calculated totals.
 * @throws {AppError} 404 if the item doesn't exist, 400 if adding the item violates single-seller cart rules.
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
 * Remove a specific item from the cart. 
 * If this was the last item in the cart, the cart is "unlocked" by clearing both restaurantId and storeId.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} cartItemId - The unique ID of the cart item entry to remove.
 * @returns {Promise<Object>} The updated cart.
 * @throws {AppError} 404 if the cart or cart item cannot be found.
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
 * Update the quantity of an existing cart item.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} cartItemId - The unique ID of the cart item entry.
 * @param {number} quantity - The new quantity to set (must be >= 1).
 * @returns {Promise<Object>} The updated cart with freshly calculated totals.
 * @throws {AppError} 404 if the cart or cart item cannot be found.
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
 * Completely clear all items from the user's cart and reset the store bindings.
 *
 * @param {string} userId - The ID of the user whose cart should be cleared.
 * @returns {Promise<void>}
 */
async function clearCart(userId) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) return;

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.cart.update({ where: { id: cart.id }, data: { restaurantId: null, storeId: null } });
}

module.exports = { getCart, addItem, removeItem, updateItemQuantity, clearCart };
