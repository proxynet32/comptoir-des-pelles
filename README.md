# Le Comptoir des Pelles

Un client déclare son métier, le comptoir lui délivre la concession de son agent IA
sur-mesure — nom, spécialité, pitch et traits générés en direct par Claude, présentés
sous forme de certificat façon registre de concession minière.

## Stack

- Next.js 14 (App Router) + TypeScript
- SQLite via Prisma (migration facile vers Postgres : il suffit de changer `DATABASE_URL`
  et le `provider` du datasource dans `prisma/schema.prisma`)
- `@anthropic-ai/sdk` pour l'appel serveur à Claude (`/v1/messages`, tool use forcé)
- Validation stricte des entrées/sorties avec `zod`
- CSS modules + design tokens custom (pas de framework CSS)

## Setup local

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configurer les variables d'environnement

Copie `.env.example` vers `.env` et renseigne ta vraie clé API Anthropic :

```bash
cp .env.example .env
```

Variables :

| Variable | Description |
| --- | --- |
| `ANTHROPIC_API_KEY` | Clé API Anthropic (jamais commitée). |
| `ANTHROPIC_MODEL` | Modèle utilisé pour la génération (défaut : `claude-sonnet-4-6`). Vérifie l'identifiant exact du modèle sur console.anthropic.com si l'appel échoue avec une erreur "model not found". |
| `DATABASE_URL` | `file:./dev.db` en local (SQLite). En prod, une URL Postgres. |

### 3. Initialiser la base de données

```bash
npx prisma migrate dev --name init
```

Cette commande crée `prisma/dev.db`, applique le schéma et régénère le client Prisma.

### 4. Lancer le serveur de dev

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000) : le formulaire de forge.
Ouvre [http://localhost:3000/registre](http://localhost:3000/registre) : le registre
des concessions déjà forgées, paginé et filtrable par métier.

## Fonctionnement de la forge (`/api/forge`)

1. Validation du corps de requête (`metier`, `precision`, `prenom`) avec `zod`.
2. Rate limiting en mémoire : 5 générations par IP et par heure (`src/lib/rateLimit.ts`).
   Suffisant pour une seule instance ; à remplacer par un store partagé (Redis) en
   multi-instance.
3. Appel à Claude avec `tool_choice` forcé sur un outil `declarer_agent` dont le schéma
   JSON impose la structure (nom, rôle, pitch, 3 traits). La réponse est revalidée avec
   le même schéma `zod` côté serveur.
4. En cas de sortie invalide ou d'absence d'appel d'outil : un seul retry automatique.
   Si le second essai échoue aussi, l'API renvoie une erreur 502 explicite — jamais de
   texte de secours inventé côté front.
5. Un numéro de claim est alloué de façon atomique (table `Counter` + transaction
   Prisma) et l'agent est persisté avec le statut `brouillon`.

## Modèle de données (`prisma/schema.prisma`)

- `Agent` : métier, précision, prénom, nom de l'agent, rôle, pitch, traits (JSON stringifié
  côté SQLite), statut (`brouillon` / `publie` — prévu pour la V2 marketplace), numéro de
  claim unique, date de création.
- `Counter` : compteur atomique à une ligne pour les numéros de claim incrémentaux.

## Passage à Postgres

1. Dans `prisma/schema.prisma`, change `provider = "sqlite"` en `provider = "postgresql"`.
2. Renseigne une vraie URL Postgres dans `DATABASE_URL`.
3. Relance `npx prisma migrate dev`.

Aucun autre changement de code n'est nécessaire (le champ `traits` stocké en JSON
stringifié fonctionne aussi bien sur Postgres ; il peut être migré vers un vrai type
`Json` ou `String[]` plus tard si besoin).

## Limites connues

- Le rate limiting est en mémoire process : il repart à zéro à chaque redémarrage du
  serveur et n'est pas partagé entre plusieurs instances.
- Le design a été recréé à partir de la description du prototype (palette, typographies,
  mise en page façon certificat) car le fichier HTML source n'a pas été fourni ; les
  tokens de couleur (`#E9DEC4`, `#A9752F`, `#211D17`, `#8B3A2B`) et les polices
  (Fraunces + Space Mono) sont appliqués tels que spécifiés.
