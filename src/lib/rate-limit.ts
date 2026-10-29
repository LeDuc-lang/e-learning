import type { SupabaseClient } from '@supabase/supabase-js';

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function getRateLimitConfig() {
  return {
    limit: readPositiveInt(process.env.AI_RATE_LIMIT_MAX, 10),
    windowMinutes: readPositiveInt(process.env.AI_RATE_LIMIT_WINDOW_MINUTES, 60),
  };
}

export interface RateLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  windowMinutes: number;
}

/**
 * Compte les appels IA récents de l'utilisateur.
 * La RLS garantit qu'un utilisateur ne voit que ses propres lignes.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<RateLimitResult> {
  const { limit, windowMinutes } = getRateLimitConfig();
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('ai_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart);

  if (error) {
    throw new Error(`Impossible de vérifier la limite de débit : ${error.message}`);
  }

  const used = count ?? 0;

  return {
    allowed: used < limit,
    used,
    limit,
    windowMinutes,
  };
}

export async function recordAiRequest(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.from('ai_requests').insert({ user_id: userId });

  if (error) {
    throw new Error(`Impossible d'enregistrer l'appel au modèle : ${error.message}`);
  }
}

export function buildRateLimitMessage(result: RateLimitResult) {
  return `Limite atteinte : ${result.used}/${result.limit} générations autorisées par ${result.windowMinutes} minutes. Réessayez plus tard.`;
}
