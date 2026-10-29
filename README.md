# SylvaLearn

## Présentation

**SylvaLearn** est une application web d'e-learning qui génère des parcours
d'apprentissage personnalisés grâce à un modèle d'intelligence artificielle.
L'utilisateur décrit son objectif, son niveau et le sujet qu'il souhaite aborder ;
l'application construit alors un parcours structuré (titre, résumé, chapitres).

L'application s'adresse aux **apprenants** (génération et consultation de leurs
parcours) et aux **enseignants / administrateurs** (supervision des services,
suivi de la consommation de l'IA).

## Adresse de production

- **Application** : `https://<nom-du-projet>.vercel.app` (à compléter avec l'adresse
  de production Vercel configurée dans le projet)
- **Santé publique** : `https://<nom-du-projet>.vercel.app/api/health`

L'application est déployée sur **Vercel** et les données sont hébergées sur
**Supabase**. L'adresse de production doit rester accessible jusqu'à la fin de
l'évaluation.

## Architecture

### Services utilisés et leur rôle

| Service | Rôle |
| --- | --- |
| **Next.js 16** (App Router) | Framework applicatif : pages, API routes, authentification, supervision |
| **Vercel** | Hébergement et fonctions serverless (contrôle `VERCEL_*` dans `/admin`) |
| **Supabase Auth** | Authentification (email + mot de passe) et gestion des sessions |
| **Supabase Database** | Postgres : profils, parcours, journaux d'appels IA, agrégats |
| **Groq** | Fournisseur d'IA (API compatible OpenAI), appel serveur uniquement |
| **Sentry** | Capture des erreurs navigateur et serveur |
| **UptimeRobot** | Surveillance externe de `GET /api/health` |

### Briques au choix et pourquoi

- **API compatible OpenAI (Groq)** : un seul fournisseur, interface familière,
  réponse JSON structurée + validation Zod avec une seconde tentative.
- **Supabase Auth + RLS** : gestion des utilisateurs et sécurité au niveau des
  lignes (pas de service role côté client).
- **Métriques IA stockées en base** (`ai_requests`, `ai_usage_stats`) : pas de
  nouveau service externe, données déjà nécessaires au quota.
- **Sentry (DSN unique)** : pas de double configuration navigateur/serveur.

## Modèle d'IA

- **Fournisseur** : Groq (configurable via `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`).
- **Modèle** : `openai/gpt-oss-20b` (exemple) — à adapter selon le fournisseur
  (`AI_BASE_URL=https://api.groq.com/openai/v1`, clé commençant par `gsk_`).
- **Justification** : rapide, open source, coût réduit, compatible OpenAI.

Le prompt système est enrichi par le contexte utilisateur (sujet, niveau, objectif,
durée). La sortie est validée par **Zod** ; en cas d'échec, une nouvelle tentative
est effectuée.

## Structure de données

| Table / objet | Rôle |
| --- | --- |
| `public.profiles` | Un profil par utilisateur (`user_id`, `email`, `full_name`, `role`) |
| `public.learning_paths` | Parcours générés (`user_id`, `topic`, `level`, `goal`, `content` JSONB) |
| `public.ai_requests` | Journalisation des appels IA (tokens, latence, statut, coût) |
| `public.ai_usage_stats(intervalle)` | Agrégats de consommation IA (security invoker) |
| `public.health_check()` | Sonde publique de santé (Postgres via RPC) |
| `public.is_admin()` | Détection du rôle admin (SECURITY DEFINER) |

- **Relations** : `learning_paths.user_id → profiles.user_id`,
  `ai_requests.user_id → profiles.user_id`.
- **RLS** : activé sur les trois tables, policies propriétaire + administrateur.
- **Métriques** : colonnes ajoutées à `ai_requests` (idempotentes), update limité
  aux colonnes de mesure.

## Lancer le projet en local

### Prérequis

- Node.js 20+
- Projet Supabase (ou local)
- Clé API Groq (ou autre fournisseur compatible)

### Commandes

```bash
npm install
cp .env.example .env.local
npm run dev
```

Puis exécuter `supabase/schema.sql` dans le SQL Editor Supabase.

### Variables d'environnement

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...   # ou NEXT_PUBLIC_SUPABASE_ANON_KEY
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=...
AI_MODEL=openai/gpt-oss-20b
AI_RATE_LIMIT_MAX=10
AI_RATE_LIMIT_WINDOW_MINUTES=60
AI_PRICE_INPUT_PER_MTOK=0.075
AI_PRICE_OUTPUT_PER_MTOK=0.30
NEXT_PUBLIC_SENTRY_DSN=...                   
UPTIMEROBOT_API_KEY=...                    
```
