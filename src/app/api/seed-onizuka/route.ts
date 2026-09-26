import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextClaimNumber } from "@/lib/claimNumber";

export const runtime = "nodejs";

// Route temporaire pour insérer un agent "prêt à l'emploi" (statut publié,
// pas généré par Claude). Idempotente : ne recrée rien si déjà présent.
// À supprimer après usage.
export async function GET() {
  const existing = await prisma.agent.findFirst({
    where: { nomAgent: "Onizuka GTO" },
  });

  if (existing) {
    return NextResponse.json({ alreadyExists: true, agent: existing });
  }

  const agent = await prisma.$transaction(async (tx) => {
    const claimNumber = await nextClaimNumber(tx);
    return tx.agent.create({
      data: {
        claimNumber,
        metier: "formation technique",
        precision:
          "Enseignement appliqué en développement, sysadmin et stratégie, basé sur la taxonomie de Bloom, la technique Feynman et le First Principles Thinking.",
        prenom: null,
        nomAgent: "Onizuka GTO",
        role: "Régisseur pédagogique",
        pitch:
          "Je transforme chaque notion complexe en application concrète immédiate, sans prose ni détour inutile.",
        traits: JSON.stringify(["Direct", "Exigeant", "Concret"]),
        statut: "publie",
      },
    });
  });

  return NextResponse.json({ created: true, agent });
}
