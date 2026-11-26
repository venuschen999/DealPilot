import { PrismaClient } from "@prisma/client";

// Dev hot reload re-evaluates modules; reuse one client so connections
// don't pile up.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
