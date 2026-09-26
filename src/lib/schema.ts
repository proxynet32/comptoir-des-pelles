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
});

export type AgentGeneration = z.infer<typeof AgentGenerationSchema>;
