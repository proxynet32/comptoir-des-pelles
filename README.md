# Le Comptoir des Pelles

Un client déclare son métier, le comptoir lui délivre la concession de son agent IA
sur-mesure — nom, spécialité, pitch et traits générés en direct par Claude, présentés
sous forme de certificat façon registre de concession minière.

## Stack

- Next.js 14 (App Router) + TypeScript
- Postgres via Prisma (ex. Vercel Postgres / Neon)
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
| `DATABASE_URL` | URL de connexion Postgres (ex. `postgresql://user:password@host:5432/dbname`). |

### 3. Initialiser la base de données

```bash
npx prisma migrate deploy
```

Cette commande applique le schéma (tables `Agent` et `Counter`) sur la base Postgres
pointée par `DATABASE_URL`, et régénère le client Prisma. Sur Vercel, ça se fait tout
seul à chaque déploiement (voir le script `vercel-build` dans `package.json`).

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

- `Agent` : métier, précision, prénom, nom de l'agent, rôle, pitch, traits (JSON stringifié),
  statut (`brouillon` / `publie` — prévu pour la V2 marketplace), numéro de claim unique,
  date de création.
- `Counter` : compteur atomique à une ligne pour les numéros de claim incrémentaux.

## Déploiement sur Vercel

1. Connecte le dépôt GitHub à un projet Vercel.
2. Dans l'onglet **Storage** du projet, crée une base Postgres et connecte-la au projet
   (Vercel y ajoute automatiquement une variable d'environnement de connexion — vérifie
   qu'une variable nommée exactement `DATABASE_URL` existe, sinon ajoute-la en copiant
   la valeur fournie).
3. Ajoute la variable `ANTHROPIC_API_KEY` (ta vraie clé, jamais commitée).
4. Déploie. Le script `vercel-build` (`prisma migrate deploy && next build`) crée les
   tables automatiquement à chaque déploiement — inutile de le faire à la main.

## Limites connues

- Le rate limiting est en mémoire process : il repart à zéro à chaque redémarrage du
  serveur et n'est pas partagé entre plusieurs instances.
- Le design a été recréé à partir de la description du prototype (palette, typographies,
  mise en page façon certificat) car le fichier HTML source n'a pas été fourni ; les
  tokens de couleur (`#E9DEC4`, `#A9752F`, `#211D17`, `#8B3A2B`) et les polices
  (Fraunces + Space Mono) sont appliqués tels que spécifiés.
