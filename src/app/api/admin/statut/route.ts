import { connection } from 'next/server';
import { getCurrentUserWithProfile, isAdmin } from '@/lib/auth';
import { CONTROLES } from '@/lib/controles';
import { calculerStatutGlobal, executerControle } from '@/lib/statut';

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export async function GET() {

  await connection();

  const { user, profile } = await getCurrentUserWithProfile();

  if (!user) {
    return json({ error: 'Vous devez être connecté pour consulter le statut des services.' }, 401);
  }

  if (!isAdmin(profile)) {
    return json({ error: 'Cette page est réservée aux administrateurs.' }, 403);
  }

  const services = await Promise.all(CONTROLES.map(executerControle));

  return json({
    verifieLe: new Date().toISOString(),
    statutGlobal: calculerStatutGlobal(services),
    services,
  });
}
