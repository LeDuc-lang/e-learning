import 'server-only';
import type { Controle } from '@/lib/statut';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const controleVercel: Controle = {
  service: 'Vercel',
  description: 'Hébergement et fonctions serverless',
  verifier: async () => {
    const environnement = process.env.VERCEL_ENV ?? 'local';
    const region = process.env.VERCEL_REGION ?? 'poste du développeur';
    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'aucun';

    return `Environnement : ${environnement} · Région : ${region} · Commit : ${commit}`;
  },
};

const controleIA: Controle = {
  service: 'Groq / Modèle d’IA',
  description: 'Génération des parcours (API compatible OpenAI)',
  verifier: async () => {
    const baseUrl = process.env.AI_BASE_URL;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;

    if (!baseUrl || !apiKey || !model) {
      throw new Error('Variables AI_BASE_URL, AI_API_KEY ou AI_MODEL manquantes');
    }

    const url = `${baseUrl.replace(/\/+$/, '')}/models`;
    const reponse = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });

    if (!reponse.ok) {
      throw new Error(`L’API a répondu avec le statut ${reponse.status}`);
    }

    const donnees = (await reponse.json()) as { data?: Array<{ id?: string }> };
    const modeleDisponible = donnees.data?.some((m) => m.id === model);

    if (!modeleDisponible) {
      throw new Error(`Le modèle ${model} n’est pas disponible chez ce fournisseur`);
    }

    return `Modèle ${model} disponible sur ${new URL(baseUrl).host}`;
  },
};

const controleBase: Controle = {
  service: 'Supabase Database',
  description: 'Base de données des parcours',
  verifier: async () => {
    const supabase = await createSupabaseServerClient();
    const { count, error } = await supabase
      .from('learning_paths')
      .select('id', { count: 'exact', head: true });

    if (error) {
      throw new Error(error.message);
    }

    return `${count ?? 0} parcours enregistré(s)`;
  },
};

const controleAuth: Controle = {
  service: 'Supabase Auth',
  description: 'Authentification et sessions utilisateur',
  verifier: async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Aucune session active');
    }

    return `Session valide pour ${data.user.email ?? data.user.id}`;
  },
};

// -----------------------------------------------------------------------------
// Services d'observabilité.
// Sans jeton d'API, on vérifie seulement que le service répond ; avec un jeton,
// on interroge le projet Sentry ou les moniteurs UptimeRobot.
// -----------------------------------------------------------------------------

function baseApiSentry() {
  if (process.env.SENTRY_API_URL) {
    return process.env.SENTRY_API_URL.replace(/\/+$/, '');
  }

  // Le DSN porte la région d'ingestion (ex. ...ingest.de.sentry.io).
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';

  if (dsn.includes('.ingest.de.')) return 'https://de.sentry.io';
  if (dsn.includes('.ingest.us.')) return 'https://us.sentry.io';
  return 'https://sentry.io';
}

const controleSentry: Controle = {
  service: 'Sentry',
  description: 'Suivi des erreurs navigateur et serveur',
  verifier: async () => {
    const base = baseApiSentry();
    const org = process.env.SENTRY_ORG;
    const project = process.env.SENTRY_PROJECT;
    const jeton = process.env.SENTRY_AUTH_TOKEN;
    const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

    if (!dsn) {
      throw new Error('DSN Sentry non configuré');
    }

    if (jeton && org && project) {
      const reponse = await fetch(`${base}/api/0/projects/${org}/${project}/`, {
        headers: { Authorization: `Bearer ${jeton}` },
        cache: 'no-store',
      });

      if (reponse.ok) {
        const projet = (await reponse.json()) as { slug?: string; platform?: string };
        return `Projet ${projet.slug ?? project} accessible${
          projet.platform ? ` (${projet.platform})` : ''
        }`;
      }

      // Un jeton de source maps n'a pas forcément le droit de lire le projet.
      if (reponse.status === 401 || reponse.status === 403) {
        return 'API joignable · jeton sans accès au projet';
      }

      throw new Error(`L’API a répondu avec le statut ${reponse.status}`);
    }

    // Sans jeton : l'API Sentry répond 401 sur une route protégée, ce qui prouve
    // qu'elle est joignable sans envoyer de données.
    const reponse = await fetch(`${base}/api/0/organizations/`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (reponse.status >= 500) {
      throw new Error(`L’API a répondu avec le statut ${reponse.status}`);
    }

    return 'DSN configuré · API joignable';
  },
};

const controleUptimeRobot: Controle = {
  service: 'UptimeRobot',
  description: 'Surveillance externe de /api/health',
  verifier: async () => {
    const cle = process.env.UPTIMEROBOT_API_KEY;

    if (!cle) {
      throw new Error('UPTIMEROBOT_API_KEY non configurée');
    }

    const corps = new URLSearchParams({ format: 'json' });
    corps.set('api_key', cle);
    corps.set('logs', '0');

    const reponse = await fetch('https://api.uptimerobot.com/v2/getMonitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: corps.toString(),
      cache: 'no-store',
    });

    if (!reponse.ok) {
      throw new Error(`L’API a répondu avec le statut ${reponse.status}`);
    }

    const donnees = (await reponse.json()) as {
      stat?: string;
      monitors?: Array<{ status?: number }>;
      error?: { message?: string };
    };

    if (donnees.stat !== 'ok') {
      throw new Error(donnees.error?.message ?? 'Réponse inattendue de l’API');
    }

    const moniteurs = donnees.monitors ?? [];
    const enLigne = moniteurs.filter((moniteur) => moniteur.status === 2).length;

    if (moniteurs.length === 0) {
      throw new Error('Aucun moniteur configuré dans UptimeRobot');
    }

    if (enLigne !== moniteurs.length) {
      throw new Error(`${enLigne}/${moniteurs.length} moniteur(s) en ligne`);
    }

    return `${enLigne}/${moniteurs.length} moniteur(s) en ligne`;
  },
};

export const CONTROLES: Controle[] = [
  // Le contrôle Vercel n'a de sens qu'une fois l'application déployée :
  // en local, il n'y a pas d'environnement Vercel à interroger.
  ...(process.env.VERCEL ? [controleVercel] : []),
  controleSentry,
  controleIA,
  controleBase,
  controleAuth,
  controleUptimeRobot,
];

// -----------------------------------------------------------------------------
// Contrôles publics : utilisés par /api/health (surveillance externe), donc
// sans session et sans révéler de configuration.
// -----------------------------------------------------------------------------

function configSupabasePublique() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !cle) {
    throw new Error('Variables NEXT_PUBLIC_SUPABASE_URL et clé publique manquantes');
  }

  return { url: url.replace(/\/+$/, ''), cle };
}

const controleBasePublic: Controle = {
  service: 'Supabase Database',
  description: 'API REST et base de données',
  verifier: async () => {
    const { url, cle } = configSupabasePublique();
    // Les clés publiques n'ont pas accès à la racine /rest/v1/ : on passe par
    // une fonction dédiée, sans lecture de table (voir schema.sql).
    const reponse = await fetch(`${url}/rest/v1/rpc/health_check`, {
      method: 'POST',
      headers: {
        apikey: cle,
        Authorization: `Bearer ${cle}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      cache: 'no-store',
    });

    if (!reponse.ok) {
      throw new Error(`L’API a répondu avec le statut ${reponse.status}`);
    }

    return 'API REST et Postgres joignables';
  },
};

const controleAuthPublic: Controle = {
  service: 'Supabase Auth',
  description: 'Service d’authentification',
  verifier: async () => {
    const { url, cle } = configSupabasePublique();
    const reponse = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: cle },
      cache: 'no-store',
    });

    if (!reponse.ok) {
      throw new Error(`L’API a répondu avec le statut ${reponse.status}`);
    }

    return 'Service d’authentification joignable';
  },
};

export const CONTROLES_PUBLICS: Controle[] = [
  controleIA,
  controleBasePublic,
  controleAuthPublic,
];
