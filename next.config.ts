import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Sans SENTRY_AUTH_TOKEN, la configuration reste valide : seuls l'envoi des
// source maps et le tunnel d'événements sont désactivés.
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
});
