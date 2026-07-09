const { Server } = require("socket.io");
const { verifyToken } = require("../common/utils/jwt");
const { DELIVERY } = require("../common/constants/roles");
const prisma = require("../config/db");
const deliveryService = require("../modules/delivery/service");
const logger = require("../common/utils/logger");

/**
 * Initialize Socket.IO on the given HTTP server.
 * @param {import("http").Server} httpServer
 * @returns {import("socket.io").Server}
 */
function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  // JWT auth middleware
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      return next(new Error("Authentication error: token missing"));
    }

    try {
      const decoded = verifyToken(token);
      socket.data.userId = decoded.id;
      socket.data.role = decoded.role;
      next();
    } catch {
      next(new Error("Authentication error: invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const { userId, role } = socket.data;

    // Delivery agents join the shared broadcast room
    if (role === DELIVERY) {
      socket.join("delivery_agents");
    }

    // Everyone joins their personal room
    socket.join(`user:${userId}`);

    /**
     * 16.5 — Customer joins an order-specific room to receive scoped location updates.
     * Emitted by the client after placing/tracking an order.
     * Event: join_order_room  payload: { order_id }
     */
    socket.on("join_order_room", ({ order_id } = {}) => {
      if (!order_id) return;
      socket.join(`order:${order_id}`);
    });

    /**
     * Extracted into a named async function for readability and testability.
     * Validates lat/lng before passing to the service.
     * 16.2 — Delivery agent emits location update via socket (alternative to HTTP endpoint).
     * Persists to DB and broadcasts to the customer's personal room.
     * Event: location:update  payload: { order_id, lat, lng }
     */
    async function handleLocationUpdate({ order_id, lat, lng } = {}) {
      if (!order_id || lat == null || lng == null) return;
      if (role !== DELIVERY) return;

      //  Validate coordinates at the socket layer before hitting the service
      if (typeof lat !== 'number' || lat < -90 || lat > 90) {
        socket.emit('error', { message: 'Invalid latitude: must be a number between -90 and 90' });
        return;
      }
      if (typeof lng !== 'number' || lng < -180 || lng > 180) {
        socket.emit('error', { message: 'Invalid longitude: must be a number between -180 and 180' });
        return;
      }

      try {
        // same logic for updateLocation is on modules/delivery/service.js just reusing that function here
        await deliveryService.updateLocation(
          order_id,
          userId,
          lat,
          lng,
          io
        );
      } catch (err) {
        //  Using Winston logger instead of console.error
        logger.error(`[Socket] location:update error for order ${order_id}: ${err.message}`, { err });
      }
    }

    socket.on("location:update", handleLocationUpdate);

    //  Using Winston logger instead of console.log
    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${socket.id} (user: ${userId})`);
    });
  });

  return io;
}

module.exports = { initSocket };
