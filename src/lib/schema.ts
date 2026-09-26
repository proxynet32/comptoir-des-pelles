import { z } from "zod";

// Ce que le front envoie à /api/forge
export const ForgeRequestSchema = z.object({
  metier: z
    .string()
    .trim()
    .min(2, "Le métier doit comporter au moins 2 caractères.")
    .max(80, "Le métier est trop long (80 caractères max)."),
  precision: z
    .string()
    .trim()
    .max(400, "La précision est trop longue (400 caractères max).")
    .optional()
    .or(z.literal("")),
  prenom: z
    .string()
    .trim()
    .max(60, "Le prénom est trop long (60 caractères max).")
    .optional()
    .or(z.literal("")),
});

export type ForgeRequest = z.infer<typeof ForgeRequestSchema>;

// Ce que Claude doit renvoyer, en JSON strict, pour un agent forgé.
export const AgentGenerationSchema = z.object({
  nomAgent: z
    .string()
    .trim()
    .min(2)
    .max(60),
  role: z
    .string()
    .trim()
    .min(2)
    .max(90),
  pitch: z
    .string()
    .trim()
    .min(10)
    .max(240),
  traits: z
    .array(z.string().trim().min(2).max(40))
    .length(3, "Il faut exactement 3 traits."),
  systemPromptXml: z
    .string()
    .trim()
    .min(120, "Le prompt système est trop court.")
    .max(4000, "Le prompt système est trop long.")
    .refine(isWellFormedAgentXml, {
      message:
        "Le prompt système doit contenir, dans l'ordre, <identity>, <rules>, <guardrails> puis <output_format>.",
    }),
});

/**
 * Vérifie que les 4 balises requises sont présentes, correctement fermées,
 * et apparaissent dans l'ordre imposé : identity, rules, guardrails, output_format.
 */
function isWellFormedAgentXml(xml: string): boolean {
  const tags = ["identity", "rules", "guardrails", "output_format"];
  let searchFrom = 0;

  for (const tag of tags) {
    const openTag = `<${tag}>`;
    const closeTag = `</${tag}>`;
    const openIndex = xml.indexOf(openTag, searchFrom);
    if (openIndex === -1) return false;

    const closeIndex = xml.indexOf(closeTag, openIndex + openTag.length);
    if (closeIndex === -1) return false;

    // Le contenu entre les balises ne doit pas être vide.
    if (xml.slice(openIndex + openTag.length, closeIndex).trim().length === 0) {
      return false;
    }

    searchFrom = closeIndex + closeTag.length;
  }

  return true;
}

export type AgentGeneration = z.infer<typeof AgentGenerationSchema>;
