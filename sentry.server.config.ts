import * as Sentry from '@sentry/nextjs';

// Sans DSN (développement local, ou projet non configuré), le SDK reste inactif.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0.1,
  dataCollection: {
    userInfo: false,
    // Les prompts contiennent l'objectif personnel de l'utilisateur.
    httpBodies: [],
  },
});
