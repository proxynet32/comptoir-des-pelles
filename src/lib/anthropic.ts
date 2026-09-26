import Anthropic from "@anthropic-ai/sdk";
import { AgentGenerationSchema, type AgentGeneration } from "./schema";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY manquante côté serveur.");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const SYSTEM_PROMPT = `Tu es le forgeron d'agents IA du "Comptoir des Pelles", un comptoir
fictif qui délivre des concessions minières numériques. Un client se présente avec son
métier ou sa discipline. Ta tâche : forger l'agent IA sur-mesure qui accompagnerait ce
métier au quotidien, et le déclarer via l'outil "declarer_agent".

Ton du contenu : registre officiel d'un bureau des mines du XIXe siècle, mais appliqué à
des outils numériques modernes. Sérieux, un peu cérémonieux, jamais ridicule ni parodique
à l'excès. Précis et concret sur ce que l'agent apporte au métier — pas de généralités
creuses ("je vous aide au quotidien" est interdit).

Consignes pour chaque champ :
- nomAgent : un nom propre à consonance de personnage (prénom + éventuellement un
  surnom de métier), 2 à 4 mots maximum. Pas de guillemets.
- role : l'intitulé du poste/de la spécialité de l'agent, formulé comme un titre de
  concession (ex. "Contremaître des plannings de chantier"), en lien direct avec le
  métier déclaré par le client.
- pitch : une seule phrase, à la première personne, qui commence par "Je" et décrit
  concrètement ce que l'agent fait pour le client (style "je fais X pour toi"). Une
  phrase seulement, pas de liste, 25 mots maximum.
- traits : exactement 3 traits de caractère ou de méthode, chacun 1 à 3 mots, qui
  distinguent cet agent (pas des synonymes les uns des autres).

Si le client fournit une précision libre sur son activité, ancre le rôle et le pitch
dans cette précision plutôt que de rester générique sur le métier seul.

Réponds uniquement en appelant l'outil "declarer_agent". N'écris aucun texte hors de
cet appel d'outil.`;

const DECLARE_AGENT_TOOL: Anthropic.Tool = {
  name: "declarer_agent",
  description:
    "Déclare officiellement l'agent IA forgé pour le client, avec son identité et son pitch.",
  input_schema: {
    type: "object",
    properties: {
      nomAgent: {
        type: "string",
        description: "Nom propre de l'agent, 2 à 4 mots.",
      },
      role: {
        type: "string",
        description: "Titre de la spécialité de l'agent, en lien avec le métier du client.",
      },
      pitch: {
        type: "string",
        description:
          "Une phrase à la première personne commençant par 'Je', décrivant ce que fait l'agent pour le client.",
      },
      traits: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
        description: "Exactement 3 traits courts qui caractérisent l'agent.",
      },
    },
    required: ["nomAgent", "role", "pitch", "traits"],
  },
};

export class AgentGenerationError extends Error {}

function buildUserMessage(input: {
  metier: string;
  precision?: string;
  prenom?: string;
}): string {
  const lines = [`Métier déclaré : ${input.metier}`];
  if (input.precision) {
    lines.push(`Précision libre du client : ${input.precision}`);
  }
  if (input.prenom) {
    lines.push(`Prénom du client (pour information, ne pas l'inclure dans le pitch) : ${input.prenom}`);
  }
  lines.push("Forge l'agent IA de ce client et déclare-le via l'outil declarer_agent.");
  return lines.join("\n");
}

function extractToolInput(message: Anthropic.Message): unknown {
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new AgentGenerationError("Claude n'a pas appelé l'outil declarer_agent.");
  }
  return toolUse.input;
}

async function callOnce(input: {
  metier: string;
  precision?: string;
  prenom?: string;
}): Promise<AgentGeneration> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    tools: [DECLARE_AGENT_TOOL],
    tool_choice: { type: "tool", name: "declarer_agent" },
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });

  const rawInput = extractToolInput(message);
  const parsed = AgentGenerationSchema.safeParse(rawInput);

  if (!parsed.success) {
    throw new AgentGenerationError(
      `Sortie Claude invalide : ${parsed.error.message}`
    );
  }

  return parsed.data;
}

/**
 * Génère un agent via Claude. Retente une fois en cas de sortie malformée ou
 * d'appel d'outil manquant, puis relance l'erreur telle quelle pour que
 * l'appelant renvoie un message d'erreur clair (jamais de texte inventé côté front).
 */
export async function generateAgent(input: {
  metier: string;
  precision?: string;
  prenom?: string;
}): Promise<AgentGeneration> {
  try {
    return await callOnce(input);
  } catch (firstError) {
    if (!(firstError instanceof AgentGenerationError)) {
      // Erreur réseau/API (401, 429, 5xx...) : on ne retente pas, on remonte telle quelle.
      throw firstError;
    }
    return await callOnce(input);
  }
}
