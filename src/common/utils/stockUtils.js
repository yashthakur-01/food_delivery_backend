'use strict';

/**
 * Atomically deduct stock for a list of grocery order items.
 * Uses a Prisma $transaction to ensure all-or-nothing semantics.
 * Each update decrements stock and increments soldCount.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {Array<{ item_id: string, quantity: number }>} items
 */
async function deductStock(prisma, items) {
  if (!items || items.length === 0) return;

  await prisma.$transaction(
    items.map((item) =>
      prisma.groceryProduct.update({
        where: { id: item.item_id },
        data: {
          stock:     { decrement: item.quantity },
          soldCount: { increment: item.quantity },
        },
      })
    )
  );

  // After decrement, auto-disable products whose stock hit 0
  await autoToggleAvailability(prisma, items.map((i) => i.item_id));
}

/**
 * Atomically restore stock for a list of grocery order items.
 * Uses a Prisma $transaction. Decrements soldCount and increments stock.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {Array<{ item_id: string, quantity: number }>} items
 */
async function restoreStock(prisma, items) {
  if (!items || items.length === 0) return;

  await prisma.$transaction(
    items.map((item) =>
      prisma.groceryProduct.update({
        where: { id: item.item_id },
        data: {
          stock:     { increment: item.quantity },
          soldCount: { decrement: item.quantity },
        },
      })
    )
  );

  // After restore, auto-enable products whose stock is now > 0
  await autoToggleAvailability(prisma, items.map((i) => i.item_id));
}

/**
 * Read current stock for the given product IDs and set isAvailable
 * based on whether stock > 0. Silently skips products that no longer exist.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string[]} productIds
 */
async function autoToggleAvailability(prisma, productIds) {
  if (!productIds || productIds.length === 0) return;

  const products = await prisma.groceryProduct.findMany({
    where: { id: { in: productIds } },
    select: { id: true, stock: true, isAvailable: true },
  });

  const updates = products.filter(
    (p) => (p.stock <= 0 && p.isAvailable) || (p.stock > 0 && !p.isAvailable)
  );

  if (updates.length === 0) return;

  await prisma.$transaction(
    updates.map((p) =>
      prisma.groceryProduct.update({
        where: { id: p.id },
        data: { isAvailable: p.stock > 0 },
      })
    )
  );
}

/**
 * Convenience helper: fetch all grocery OrderItems for an order and restore
 * their stock. Called from cancelOrder and payment-failure paths.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} orderId
 */
async function restoreStockForOrder(prisma, orderId) {
  const orderItems = await prisma.orderItem.findMany({
    where: { orderId },
    select: { groceryProductId: true, quantity: true },
  });

  const groceryItems = orderItems
    .filter((i) => i.groceryProductId)
    .map((i) => ({ item_id: i.groceryProductId, quantity: i.quantity }));

  await restoreStock(prisma, groceryItems);
}

module.exports = {
  deductStock,
  restoreStock,
  autoToggleAvailability,
  restoreStockForOrder,
};
