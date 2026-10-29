# SylvaLearn

Application e-learning Next.js déployable sur Vercel : génération de parcours
d'apprentissage par un modèle d'IA hébergé, avec authentification Supabase,
Row Level Security et limitation de débit par utilisateur.

## Socle technique

| Exigence | Implémentation |
| --- | --- |
| Application en ligne | Next.js 16 (App Router), prêt pour Vercel |
| Modèle d'IA hébergé | `src/lib/ai.ts` : API compatible OpenAI, **côté serveur uniquement**, configurée par `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` ; réponse validée par Zod (avec une nouvelle tentative si le JSON est invalide) |
| Base de données | `supabase/schema.sql` : `profiles`, `learning_paths`, `ai_requests`, reliées par clés étrangères, avec `user_id` dans chaque table |
| Authentification | Email + mot de passe (`/login`, `/signup`), session rafraîchie dans `src/proxy.ts`, RLS sur **toutes** les tables |
| Limitation de débit | Quota par utilisateur (`AI_RATE_LIMIT_MAX` appels / `AI_RATE_LIMIT_WINDOW_MINUTES`), réponse HTTP 429 avec message affiché dans l'interface |
| Page `/admin` | Réservée au rôle `admin` : tableau de bord temps réel de Groq, Supabase Database, Supabase Auth, Sentry et UptimeRobot, plus Vercel lorsque l'application est déployée, avec statut, latence et détail |
| Observabilité | Sentry capture les erreurs navigateur et serveur ; `/api/health` sert de sonde publique ; `/admin` affiche l'état des services |

## Démarrage local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Renseignez ensuite les variables dans `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=...
AI_MODEL=openai/gpt-oss-20b
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` est également accepté pour les configurations
existantes. `AI_BASE_URL`, `AI_API_KEY` et `AI_MODEL` doivent appartenir au
**même fournisseur** : une clé Groq (`gsk_...`) s'utilise avec
`https://api.groq.com/openai/v1`, une clé OpenAI (`sk-...`) avec
`https://api.openai.com/v1`. Un mélange des deux produit une erreur `401`.
Après avoir créé ou modifié `.env.local`, redémarrez le serveur Next.js.

## Configuration Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Ouvrez **SQL Editor** et exécutez le contenu de [`supabase/schema.sql`](supabase/schema.sql).
3. Dans **Authentication > Providers**, activez Email. Pour tester rapidement,
   désactivez « Confirm email » (**Authentication > Sign In / Providers**) ; sinon
   confirmez l'email reçu à l'inscription.
4. Créez un compte via `/signup`, puis attribuez-lui le rôle admin dans le SQL Editor :

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'votre-email@exemple.com';
   ```

5. Reconnectez-vous : le lien **Administration** apparaît sur le tableau de bord.

Le script active la RLS sur les trois tables, crée les policies « propriétaire »
et « administrateur », et installe le trigger qui crée automatiquement un profil
à chaque inscription (`auth.users` → `public.profiles`).

Le script est **idempotent** : si la base existe déjà, réexécutez-le après une
mise à jour pour ajouter les colonnes de métriques, la fonction
`ai_usage_stats` et la sonde `health_check`.

## Routes

| Route | Accès | Rôle |
| --- | --- | --- |
| `/` | public avec session | Générateur de parcours ; redirige les visiteurs non connectés vers `/login` |
| `/login`, `/signup` | public | Authentification |
| `/app/dashboard` | connecté | Parcours de l'utilisateur (RLS) |
| `/admin` | rôle `admin` | Supervision des services |
| `GET /api/admin/statut` | rôle `admin` | Contrôles de santé (Vercel, Groq, Supabase Database, Supabase Auth, Sentry, UptimeRobot) |
| `GET /api/health` | public | Sonde de surveillance externe (UptimeRobot) |
| `POST /api/generate` | connecté | Appel IA + enregistrement + quota |

## Supervision (`/admin`)

La page `/admin` est réservée aux administrateurs. Elle appelle
`GET /api/admin/statut`, qui exécute les contrôles **côté serveur** et en parallèle :

| Service | Contrôle |
| --- | --- |
| Vercel | Environnement, région d'exécution et commit déployé — ligne affichée uniquement lorsque l'application tourne sur Vercel |
| Groq / Modèle d'IA | `GET {AI_BASE_URL}/models` sans consommer de tokens, puis vérification que `AI_MODEL` est disponible |
| Supabase Database | Comptage léger de `learning_paths` (`head: true`) |
| Supabase Auth | Récupération de l'utilisateur courant (`auth.getUser()`) |
| Sentry | DSN obligatoire et API joignable ; avec `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT`, vérification d'accès au projet |
| UptimeRobot | `POST /v2/getMonitors` avec `UPTIMEROBOT_API_KEY` ; opérationnel seulement si au moins un moniteur existe et que tous sont en ligne |

Les contrôles Sentry et UptimeRobot restent visibles même si leur configuration
est absente, mais sont alors signalés en panne au lieu d'être présentés comme
opérationnels.

Chaque contrôle est limité à **5 secondes** ; une réponse en plus de
**2 secondes** est signalée comme dégradée. La page se rafraîchit toutes les
30 secondes et propose un bouton **Relancer les tests**.

### Sentry (suivi des erreurs)

Sentry reste **inactif** tant que `NEXT_PUBLIC_SENTRY_DSN` (ou `SENTRY_DSN` côté
serveur) n'est pas renseigné : le développement local n'envoie rien. Un seul DSN
suffit, et il n'est pas secret (il ne permet que d'envoyer des événements).
Une fois le DSN ajouté,
`src/instrumentation.ts` capture les erreurs serveur (avec `VERCEL_ENV` et le
commit déployé) et `src/instrumentation-client.ts` les erreurs navigateur.
`dataCollection.httpBodies` est vide : les prompts, qui contiennent l'objectif
personnel, ne sont jamais envoyés.

Pour les source maps sur Vercel, ajoutez `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` et
`SENTRY_PROJECT`. Sans eux, le build fonctionne mais les piles restent minifiées.
Ces trois variables servent aussi à `/admin` pour interroger le projet via l'API
Sentry (le jeton doit avoir le droit de lecture du projet). La région de l'API est
déduite du DSN (`de.sentry.io`, `us.sentry.io`) et peut être forcée avec
`SENTRY_API_URL`.

### Surveillance externe (UptimeRobot)

`GET /api/health` est public, sans session, et n'expose **aucun** détail de
configuration : uniquement le nom des services, leur statut et leur latence.
Elle renvoie `200` si tout va bien, `503` dès qu'un service est en panne.

Contrôles : Groq (`/models`, sans tokens), Supabase Database (RPC `health_check`,
sans lecture de table) et Supabase Auth (`/auth/v1/health`).

Sur UptimeRobot : monitor HTTP(s) sur `https://votre-domaine/api/health`,
intervalle 5 minutes, alerte sur le statut HTTP. La page de statut publique est
générée par UptimeRobot, pas par l'application.

`/admin` affiche aussi une ligne UptimeRobot. Ajoutez la clé de lecture
(**My Settings > API Keys**) dans `UPTIMEROBOT_API_KEY` pour que l'application
vérifie l'état des moniteurs. Le statut est opérationnel seulement si au moins
un moniteur existe et que tous les moniteurs sont en ligne. La surveillance
reste hébergée chez UptimeRobot : l'application ne fait que l'interroger.

## Sécurité

- La clé du modèle d'IA n'est jamais exposée au client : seul `POST /api/generate`
  (route serveur) appelle le fournisseur.
- Chaque requête Supabase côté utilisateur utilise la clé anonyme + la session ;
  la RLS empêche l'accès aux lignes des autres utilisateurs.
- Le rôle admin est protégé par `public.is_admin()` (SECURITY DEFINER) et ne peut
  pas être modifié par un utilisateur via l'API.
- Les appels IA sont journalisés dans `ai_requests` avant l'appel au modèle ; le
  dépassement renvoie `429` avec un message explicite.
- Les métriques sont complétées par un `update` limité aux colonnes de mesure
  (grant colonne par colonne) : un utilisateur ne peut ni changer `user_id` ni
  lire les lignes d'un autre, et l'API ne renvoie jamais de secret.
- `/api/health` ne renvoie aucun message d'erreur détaillé et ne consomme pas de
  tokens IA.

## Déploiement Vercel

1. Poussez le dépôt sur GitHub, importez-le dans Vercel.
2. Ajoutez les variables d'environnement ci-dessus (Production, Preview, Development).
   Facultatif : `AI_PRICE_*` pour le coût, `SENTRY_DSN` /
   `NEXT_PUBLIC_SENTRY_DSN` pour les erreurs, `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` /
   `SENTRY_PROJECT` pour les source maps, et `UPTIMEROBOT_API_KEY` pour vérifier
   l'état réel des moniteurs UptimeRobot dans `/admin`.
3. Déployez. Le proxy Next.js gère le rafraîchissement de session sur Vercel.
4. Après le déploiement, créez le monitor UptimeRobot sur `/api/health` et
   vérifiez que `/admin` affiche Sentry et UptimeRobot opérationnels, ainsi que
   la ligne Vercel.
