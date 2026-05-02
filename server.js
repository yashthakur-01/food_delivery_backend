require("dotenv").config();
const paymentRoutes = require("./src/modules/payment/routes");
const notificationRoutes = require("./src/modules/notification/routes");
const adminRoutes = require("./src/modules/admin/routes");
const deliveryRoutes = require("./src/modules/delivery/routes");
const cartRoutes = require("./src/modules/cart/routes");
const vendorRoutes = require("./src/modules/vendor/routes");
const express = require("express");
const http = require("http");
const morgan = require("morgan");
const env = require("./src/config/env");
const rateLimiter = require("./src/common/middleware/rateLimiter");
const errorHandler = require("./src/common/middleware/errorHandler");
const { initSocket } = require("./src/sockets");

const authRoutes = require("./src/modules/auth/routes");
const userRoutes = require("./src/modules/user/routes");
const restaurantRoutes = require("./src/modules/restaurant/routes");

const app = express();
const server = http.createServer(app);
const io = initSocket(server);

app.use(express.json());
app.use(morgan("dev"));
app.use(rateLimiter);
app.use("/api/delivery", deliveryRoutes);

app.get("/", (req, res) => {
  res.json({ success: true, message: "API is running" });
});

app.get("/health", async (req, res) => {
  const health = {
    success: true,
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      database: "unknown",
      redis: "unknown",
    },
  };

  try {
    const prisma = require("./src/config/db");
    await prisma.$runCommandRaw({ ping: 1 });
    health.services.database = "connected";
  } catch (err) {
    health.services.database = "disconnected";
    health.status = "degraded";
  }

  try {
    const redis = require("./src/config/redis");
    await redis.ping();
    health.services.redis = "connected";
  } catch (err) {
    health.services.redis = "disconnected";
    health.status = "degraded";
  }

  const statusCode = health.status === "healthy" ? 200 : 503;
  res.status(statusCode).json(health);
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/vendor", vendorRoutes);

app.set('io', io);

app.use(errorHandler);

const { startJobs } = require('./src/jobs');

server.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
  startJobs();
});