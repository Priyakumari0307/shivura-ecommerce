import "server-only";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "./generated/prisma/client";

// Guard against unexpected client-side invocation
if (typeof window !== "undefined") {
  throw new Error(
    "lib/prisma: Prisma Client is server-only and cannot be executed on the client."
  );
}

/**
 * Factory function to instantiate PrismaClient with the official Neon adapter.
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is missing. Please define DATABASE_URL in your environment or .env file."
    );
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

// Global singleton pattern to prevent multiple PrismaClient instances during Next.js HMR/hot-reloading
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Recreate instance if cached HMR instance lacks recently generated models (e.g. siteSetting)
if (
  globalForPrisma.prisma &&
  !(globalForPrisma.prisma as unknown as { siteSetting?: unknown }).siteSetting
) {
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
export { PrismaClient, Prisma } from "./generated/prisma/client";
