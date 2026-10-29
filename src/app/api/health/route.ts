import { connection } from 'next/server';
import { CONTROLES_PUBLICS } from '@/lib/controles';
import { calculerStatutGlobal, executerControle } from '@/lib/statut';

/**
 * Route de santé publique, prévue pour la surveillance externe (UptimeRobot).
 * Elle ne demande aucune session et n'expose ni configuration ni message
 * d'erreur détaillé : uniquement le nom du service, son statut et sa latence.
 * HTTP 503 dès qu'un service est en panne, pour que le moniteur alerte.
 */
export async function GET() {
  await connection();

  const services = await Promise.all(CONTROLES_PUBLICS.map(executerControle));
  const statut = calculerStatutGlobal(services);

  return Response.json(
    {
      statut,
      verifieLe: new Date().toISOString(),
      services: services.map(({ service, statut: statutService, latenceMs }) => ({
        service,
        statut: statutService,
        latenceMs,
      })),
    },
    {
      status: statut === 'en_panne' ? 503 : 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
