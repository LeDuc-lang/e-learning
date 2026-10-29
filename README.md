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
| Page `/admin` | Réservée au rôle `admin`, supervision de Supabase, du modèle IA, de l'authentification et des quotas |

## Démarrage local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Renseignez ensuite les variables dans `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=...
AI_MODEL=gpt-4o-mini
```

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

## Routes

| Route | Accès | Rôle |
| --- | --- | --- |
| `/` | public | Générateur de parcours |
| `/login`, `/signup` | public | Authentification |
| `/app/dashboard` | connecté | Parcours de l'utilisateur (RLS) |
| `/admin` | rôle `admin` | Supervision des services |
| `POST /api/generate` | connecté | Appel IA + enregistrement + quota |

## Sécurité

- La clé du modèle d'IA n'est jamais exposée au client : seul `POST /api/generate`
  (route serveur) appelle le fournisseur.
- Chaque requête Supabase côté utilisateur utilise la clé anonyme + la session ;
  la RLS empêche l'accès aux lignes des autres utilisateurs.
- Le rôle admin est protégé par `public.is_admin()` (SECURITY DEFINER) et ne peut
  pas être modifié par un utilisateur via l'API.
- Les appels IA sont journalisés dans `ai_requests` avant l'appel au modèle ; le
  dépassement renvoie `429` avec un message explicite.

## Déploiement Vercel

1. Poussez le dépôt sur GitHub, importez-le dans Vercel.
2. Ajoutez les variables d'environnement ci-dessus (Production, Preview, Development).
3. Déployez. Aucun réglage supplémentaire n'est nécessaire ; le proxy Next.js
   gère le rafraîchissement de session sur Vercel.
