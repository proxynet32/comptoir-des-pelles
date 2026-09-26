import path from "node:path";
import { PrismaClient } from "@prisma/client";

// La CLI Prisma (migrate, studio...) résout une URL SQLite relative ("file:./x")
// par rapport au dossier de prisma/schema.prisma. Le client généré, lui, la résout
// par rapport à son propre dossier de sortie (node_modules/.prisma/client), ce qui
// pointe ailleurs et créerait une base vide à côté du client. On force donc ici la
// même convention que la CLI (relative à prisma/) pour cibler le même fichier.
// Les URLs non-SQLite (Postgres, etc.) sont laissées telles quelles.
function resolvedDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("file:")) return url;

  const relativePath = url.slice("file:".length);
  if (path.isAbsolute(relativePath)) return url;

  const absolutePath = path.resolve(process.cwd(), "prisma", relativePath);
  return `file:${absolutePath}`;
}

// Évite de recréer une nouvelle instance de PrismaClient à chaque hot-reload en dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolvedDatabaseUrl() } },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
