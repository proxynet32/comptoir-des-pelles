-- CreateTable
CREATE TABLE "Counter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimNumber" INTEGER NOT NULL,
    "metier" TEXT NOT NULL,
    "precision" TEXT,
    "prenom" TEXT,
    "nomAgent" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "pitch" TEXT NOT NULL,
    "traits" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_claimNumber_key" ON "Agent"("claimNumber");

-- CreateIndex
CREATE INDEX "Agent_metier_idx" ON "Agent"("metier");

-- CreateIndex
CREATE INDEX "Agent_createdAt_idx" ON "Agent"("createdAt");
