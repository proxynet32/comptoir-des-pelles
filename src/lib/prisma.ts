import { PrismaClient } from "@prisma/client";

// Évite de recréer une nouvelle instance de PrismaClient à chaque hot-reload en dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Conservé pour compatibilité d'appel ; la base Postgres n'a pas besoin d'init paresseuse. */
export async function ensurePrismaReady(): Promise<void> {}
