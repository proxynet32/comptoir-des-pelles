import { NextRequest, NextResponse } from "next/server";
import { prisma, ensurePrismaReady } from "@/lib/prisma";
import { ForgeRequestSchema } from "@/lib/schema";
import { generateAgent, AgentGenerationError } from "@/lib/anthropic";
import { checkRateLimit, getClientIdentifier } from "@/lib/rateLimit";
import { nextClaimNumber } from "@/lib/claimNumber";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const identifier = getClientIdentifier(request.headers);
  const rateLimit = checkRateLimit(identifier);

  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.ceil(rateLimit.retryAfterMs / 1000);
    return NextResponse.json(
      {
        error: `Trop de forges depuis cette adresse. Réessaie dans ${Math.ceil(
          retryAfterSeconds / 60
        )} minute(s).`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête JSON invalide." },
      { status: 400 }
    );
  }

  const parsedRequest = ForgeRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error:
          parsedRequest.error.issues[0]?.message ??
          "Formulaire invalide.",
      },
      { status: 400 }
    );
  }

  const { metier, precision, prenom } = parsedRequest.data;

  let generation;
  try {
    generation = await generateAgent({
      metier,
      precision: precision || undefined,
      prenom: prenom || undefined,
    });
  } catch (error) {
    if (error instanceof AgentGenerationError) {
      return NextResponse.json(
        {
          error:
            "Le forgeron d'agents n'a pas réussi à produire une déclaration valide. Réessaie dans un instant.",
        },
        { status: 502 }
      );
    }
    console.error("Erreur d'appel à l'API Claude:", error);
    return NextResponse.json(
      { error: "Le service de forge est momentanément indisponible." },
      { status: 502 }
    );
  }

  try {
    await ensurePrismaReady();
    const agent = await prisma.$transaction(async (tx) => {
      const claimNumber = await nextClaimNumber(tx);
      return tx.agent.create({
        data: {
          claimNumber,
          metier,
          precision: precision || null,
          prenom: prenom || null,
          nomAgent: generation.nomAgent,
          role: generation.role,
          pitch: generation.pitch,
          traits: JSON.stringify(generation.traits),
          systemPromptXml: generation.systemPromptXml,
          statut: "brouillon",
        },
      });
    });

    return NextResponse.json({
      agent: {
        id: agent.id,
        claimNumber: agent.claimNumber,
        metier: agent.metier,
        precision: agent.precision,
        prenom: agent.prenom,
        nomAgent: agent.nomAgent,
        role: agent.role,
        pitch: agent.pitch,
        traits: JSON.parse(agent.traits) as string[],
        systemPromptXml: agent.systemPromptXml,
        statut: agent.statut,
        createdAt: agent.createdAt,
      },
    });
  } catch (error) {
    console.error("Erreur de persistance de l'agent:", error);
    return NextResponse.json(
      { error: "L'agent a été forgé mais n'a pas pu être enregistré au registre." },
      { status: 500 }
    );
  }
}
