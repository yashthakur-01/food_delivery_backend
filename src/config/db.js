const { PrismaClient } = require("@prisma/client");

const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
  console.log(process.env.DATABASE_URL,"database URL:");
}

module.exports = prisma;