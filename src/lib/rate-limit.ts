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

/**
 * Enregistre la tentative avant l'appel et renvoie son identifiant, pour
 * pouvoir la compléter ensuite avec les métriques (tokens, latence, coût).
 */
export async function recordAiRequest(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('ai_requests')
    .insert({ user_id: userId })
    .select('id')
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(
      `Impossible d'enregistrer l'appel au modèle : ${error?.message ?? 'aucune ligne renvoyée'}`
    );
  }

  return data.id;
}

export interface AiRequestMetrics {
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  attempts: number | null;
  status: 'succes' | 'erreur';
  costUsd: number | null;
}

/**
 * Complète la ligne avec les métriques observées. Un échec ici ne doit jamais
 * faire échouer la requête utilisateur : on se contente de journaliser.
 */
export async function finalizeAiRequest(
  supabase: SupabaseClient,
  id: string,
  metrics: AiRequestMetrics
) {
  const { error } = await supabase
    .from('ai_requests')
    .update({
      model: metrics.model,
      prompt_tokens: metrics.promptTokens,
      completion_tokens: metrics.completionTokens,
      latency_ms: metrics.latencyMs,
      attempts: metrics.attempts,
      status: metrics.status,
      cost_usd: metrics.costUsd,
    })
    .eq('id', id);

  if (error) {
    console.error('[rate-limit] métriques non enregistrées :', error.message);
  }
}

export function buildRateLimitMessage(result: RateLimitResult) {
  return `Limite atteinte : ${result.used}/${result.limit} générations autorisées par ${result.windowMinutes} minutes. Réessayez plus tard.`;
}
