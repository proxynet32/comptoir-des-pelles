import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// Sur Vercel, seul le dossier /tmp est inscriptible à l'exécution (le reste du
// projet est en lecture seule). On y place donc la base SQLite ; elle repart
// vide à chaque démarrage à froid — acceptable pour une démo, pas pour de la
// persistance long terme (voir README, section "passage à Postgres").
const isVercel = Boolean(process.env.VERCEL);

// La CLI Prisma (migrate, studio...) résout une URL SQLite relative ("file:./x")
// par rapport au dossier de prisma/schema.prisma. Le client généré, lui, la résout
// par rapport à son propre dossier de sortie (node_modules/.prisma/client), ce qui
// pointe ailleurs et créerait une base vide à côté du client. On force donc ici la
// même convention que la CLI (relative à prisma/) pour cibler le même fichier.
// Les URLs non-SQLite (Postgres, etc.) sont laissées telles quelles.
function resolvedDatabaseUrl(): { url: string | undefined; ephemeral: boolean } {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("file:")) {
    return { url, ephemeral: false };
  }

  const relativePath = url.slice("file:".length);
  if (path.isAbsolute(relativePath)) {
    return { url, ephemeral: false };
  }

  if (isVercel) {
    return { url: "file:/tmp/comptoir-des-pelles.db", ephemeral: true };
  }

  const absolutePath = path.resolve(process.cwd(), "prisma", relativePath);
  return { url: `file:${absolutePath}`, ephemeral: false };
}

const { url: databaseUrl, ephemeral } = resolvedDatabaseUrl();

function loadMigrationStatements(): string[] {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  const folders = fs
    .readdirSync(migrationsDir)
    .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
    .sort();

  const statements: string[] = [];
  for (const folder of folders) {
    const sqlPath = path.join(migrationsDir, folder, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;
    const sql = fs.readFileSync(sqlPath, "utf-8");
    for (const raw of sql.split(";")) {
      const statement = raw.trim();
      if (statement) statements.push(statement);
    }
  }
  return statements;
}

async function ensureEphemeralSchema(client: PrismaClient): Promise<void> {
  for (const statement of loadMigrationStatements()) {
    try {
      await client.$executeRawUnsafe(statement);
    } catch (error) {
      // Une même instance serveur "chaude" peut retraiter cette fonction plusieurs
      // fois (hot reload, appels concurrents) : on ignore juste les tables déjà là.
      if (!String(error).includes("already exists")) throw error;
    }
  }
}

// Évite de recréer une nouvelle instance de PrismaClient à chaque hot-reload en dev.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaReady?: Promise<void>;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

if (ephemeral && !globalForPrisma.prismaSchemaReady) {
  globalForPrisma.prismaSchemaReady = ensureEphemeralSchema(prisma);
}

/** À appeler avant toute requête, pour laisser le temps à la base éphémère (Vercel) de se créer. */
export async function ensurePrismaReady(): Promise<void> {
  if (globalForPrisma.prismaSchemaReady) {
    await globalForPrisma.prismaSchemaReady;
  }
}
