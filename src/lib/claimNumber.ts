import { Prisma, PrismaClient } from "@prisma/client";

const COUNTER_ID = "claim";

/**
 * Alloue le prochain numéro de claim de façon atomique via un upsert transactionnel
 * sur la table Counter. À utiliser à l'intérieur d'un prisma.$transaction pour que
 * l'allocation et la création de l'Agent soient atomiques ensemble.
 */
export async function nextClaimNumber(
  tx: Prisma.TransactionClient | PrismaClient
): Promise<number> {
  const counter = await tx.counter.upsert({
    where: { id: COUNTER_ID },
    create: { id: COUNTER_ID, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

export function formatClaimNumber(claimNumber: number): string {
  return String(claimNumber).padStart(6, "0");
}
