import { z } from 'zod';
import { generateLearningPath } from '@/lib/ai';
import { buildRateLimitMessage, checkRateLimit, recordAiRequest } from '@/lib/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const requestSchema = z.object({
  topic: z.string().trim().min(3).max(120),
  level: z.enum(['debutant', 'intermediaire', 'avance']),
  goal: z.string().trim().min(5).max(600),
  timeAmount: z.coerce.number().int().min(5).max(600),
  timeFrequency: z.enum(['jour', 'semaine']),
  durationAmount: z.coerce.number().int().min(1).max(365),
  durationUnit: z.enum(['jours', 'semaines']),
});

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: 'Vous devez être connecté pour générer un parcours.' }, 401);
  }

  const body = await request.json().catch(() => null);
  const input = requestSchema.safeParse(body);

  if (!input.success) {
    return json(
      {
        error: 'Paramètres invalides. Vérifiez le sujet, le niveau, l’objectif et la durée.',
        details: input.error.flatten().fieldErrors,
      },
      400
    );
  }

  try {
    const rateLimit = await checkRateLimit(supabase, user.id);

    if (!rateLimit.allowed) {
      return json({ error: buildRateLimitMessage(rateLimit), code: 'RATE_LIMITED' }, 429);
    }

    // On enregistre la tentative avant l'appel : les essais en échec comptent aussi.
    await recordAiRequest(supabase, user.id);

    const generated = await generateLearningPath(input.data);

    const { data: savedPath, error: insertError } = await supabase
      .from('learning_paths')
      .insert({
        user_id: user.id,
        topic: input.data.topic,
        level: input.data.level,
        goal: input.data.goal,
        title: generated.title,
        summary: generated.summary,
        content: generated,
      })
      .select('id, title, summary, created_at')
      .single();

    if (insertError) {
      throw new Error(`Enregistrement impossible : ${insertError.message}`);
    }

    return json(
      {
        path: savedPath,
        remaining: Math.max(rateLimit.limit - rateLimit.used - 1, 0),
      },
      201
    );
  } catch (error) {
    console.error('[api/generate]', error);
    return json(
      { error: 'La génération du parcours a échoué. Merci de réessayer dans un instant.' },
      502
    );
  }
}
