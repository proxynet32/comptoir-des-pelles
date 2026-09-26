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
- systemPromptXml : un vrai prompt système, autonome et prêt à être collé tel quel dans
  Claude (system prompt / Projects) ou dans ChatGPT (Custom Instructions / system
  message) pour qu'il incarne cet agent pour de vrai — pas un résumé marketing du
  certificat. Format XML strict, EXACTEMENT ces 4 balises, dans cet ordre, chacune
  ouverte et fermée, jamais vide :

  <identity>
  Nom de l'agent, métier/domaine de spécialisation, posture (ex. "expert senior en
  fiscalité indépendante, direct et sans jargon"). 2 à 4 phrases maximum. Jamais de
  tournure publicitaire ("je vous aide au quotidien" interdit ici aussi).
  </identity>

  <rules>
  4 à 7 règles de comportement concrètes et actionnables, SPÉCIFIQUES au métier et à la
  précision libre donnés par le client — jamais de généralité interchangeable d'un
  agent à l'autre. Exemple pour un agent comptable : "Signale toujours si un montant
  semble incohérent avant de le traiter" plutôt que "Sois précis". Formate en liste
  (une règle par ligne, tiret ou numéro).
  </rules>

  <guardrails>
  Limites explicites : ce que l'agent ne fait JAMAIS, adaptées au métier (ex. un agent
  comptable ne donne jamais de conseil fiscal définitif et recommande de vérifier avec
  un professionnel sur les points sensibles ; un agent musicien n'a pas les mêmes
  limites qu'un agent comptable — invente les limites propres à CE métier, n'invente
  jamais de chiffres/sources dans tous les cas).
  </guardrails>

  <output_format>
  Comment l'agent doit structurer ses réponses par défaut pour ce métier précis :
  longueur, ton, usage de listes/exemples, première ou troisième personne. Concret et
  applicable immédiatement par le modèle qui lira ce prompt.
  </output_format>

  Aucune balise ni syntaxe propre à un seul fournisseur (pas de balises Anthropic
  autres que cette structure XML elle-même, qui doit être lisible telle quelle par
  Claude et par ChatGPT). N'enveloppe jamais le tout dans <![CDATA[ ]]> : commence
  directement par <identity> et termine par </output_format>. Le contenu de <rules> et <guardrails> DOIT varier
  concrètement d'un métier à l'autre : ne recycle jamais une règle ou une limite
  générique d'un agent précédent.

Si le client fournit une précision libre sur son activité, ancre le rôle, le pitch et
le prompt système (surtout <rules> et <guardrails>) dans cette précision plutôt que de
rester générique sur le métier seul.

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
      systemPromptXml: {
        type: "string",
        description:
          "Prompt système XML complet et autonome, avec exactement 4 balises dans l'ordre <identity>, <rules>, <guardrails>, <output_format>, prêt à coller tel quel dans Claude ou ChatGPT.",
      },
    },
    required: ["nomAgent", "role", "pitch", "traits", "systemPromptXml"],
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

/**
 * Claude enveloppe parfois systemPromptXml dans <![CDATA[ ... ]]>, ce qui n'a aucun
 * intérêt une fois collé tel quel dans un assistant IA. On retire ce wrapper s'il
 * est présent, sans toucher au reste du contenu.
 */
function stripCdataWrapper(input: unknown): unknown {
  if (
    typeof input !== "object" ||
    input === null ||
    !("systemPromptXml" in input) ||
    typeof (input as Record<string, unknown>).systemPromptXml !== "string"
  ) {
    return input;
  }

  const record = input as Record<string, unknown>;
  const raw = (record.systemPromptXml as string).trim();
  const cdataMatch = raw.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);

  return {
    ...record,
    systemPromptXml: cdataMatch ? cdataMatch[1].trim() : raw,
  };
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
    max_tokens: 1600,
    system: SYSTEM_PROMPT,
    tools: [DECLARE_AGENT_TOOL],
    tool_choice: { type: "tool", name: "declarer_agent" },
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });

  const rawInput = stripCdataWrapper(extractToolInput(message));
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
