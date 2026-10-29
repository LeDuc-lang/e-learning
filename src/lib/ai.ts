import { z } from 'zod';

export const learningPathSchema = z.object({
  title: z.string().trim().min(3).max(120),
  summary: z.string().trim().min(10).max(600),
  weeks: z
    .array(
      z.object({
        week: z.number().int().min(1).max(52),
        theme: z.string().trim().min(3).max(120),
        objectives: z.array(z.string().trim().min(3).max(200)).min(1).max(5),
        activities: z.array(z.string().trim().min(3).max(200)).min(1).max(5),
      })
    )
    .min(1)
    .max(12),
});

export type LearningPathData = z.infer<typeof learningPathSchema>;

export interface LearningPathRequest {
  topic: string;
  level: 'debutant' | 'intermediaire' | 'avance';
  goal: string;
  timeAmount: number;
  timeFrequency: 'jour' | 'semaine';
  durationAmount: number;
  durationUnit: 'jours' | 'semaines';
}

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function getAiConfigStatus() {
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  return {
    configured: Boolean(baseUrl && apiKey && model),
    baseUrl: baseUrl ?? null,
    model: model ?? null,
    hasApiKey: Boolean(apiKey),
  };
}

function getAiConfig(): AiConfig {
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!baseUrl || !apiKey || !model) {
    throw new Error('Le service IA est mal configuré : AI_BASE_URL, AI_API_KEY et AI_MODEL sont requis.');
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model };
}

const SYSTEM_PROMPT = `Tu es un concepteur pédagogique francophone.
Tu construis des parcours d'apprentissage réalistes, progressifs et actionnables.
Tu réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format exact suivant :
{
  "title": "titre court du parcours",
  "summary": "résumé de 2 à 4 phrases",
  "weeks": [
    {
      "week": 1,
      "theme": "thème de la semaine",
      "objectives": ["objectif 1", "objectif 2"],
      "activities": ["activité 1", "activité 2"]
    }
  ]
}
Contraintes : entre 1 et 12 semaines, 1 à 5 objectifs et 1 à 5 activités par semaine.`;

function buildUserPrompt(input: LearningPathRequest) {
  const weeks =
    input.durationUnit === 'semaines'
      ? input.durationAmount
      : Math.ceil(input.durationAmount / 7);

  return `Crée un parcours d'apprentissage en français.

Sujet : ${input.topic}
Niveau : ${input.level}
Objectif personnel : ${input.goal}
Temps disponible : ${input.timeAmount} minutes par ${input.timeFrequency}
Durée souhaitée : ${input.durationAmount} ${input.durationUnit} (soit ${Math.min(Math.max(weeks, 1), 12)} semaines)

Adapte le nombre de semaines à la durée indiquée.`;
}

interface ChatCompletionOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
}

async function callChatCompletion({ messages, maxTokens = 2000 }: ChatCompletionOptions) {
  const config = getAiConfig();

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.4,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Le modèle IA a répondu ${response.status}. ${details.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Le modèle IA n'a renvoyé aucun contenu.");
  }

  return content;
}

function parseLearningPath(content: string): LearningPathData {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const parsed = learningPathSchema.safeParse(JSON.parse(cleaned));

  if (!parsed.success) {
    throw new Error('La réponse du modèle ne respecte pas le format attendu.');
  }

  return parsed.data;
}

/**
 * Appelle le modèle hébergé (API compatible OpenAI), vérifie la structure
 * de la réponse avec Zod et retente une fois si le JSON est invalide.
 */
export async function generateLearningPath(input: LearningPathRequest): Promise<LearningPathData> {
  const messages: ChatCompletionOptions['messages'] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(input) },
  ];

  const firstAnswer = await callChatCompletion({ messages });

  try {
    return parseLearningPath(firstAnswer);
  } catch {
    const retryAnswer = await callChatCompletion({
      messages: [
        ...messages,
        { role: 'assistant', content: firstAnswer },
        {
          role: 'user',
          content:
            'Ta réponse précédente ne respecte pas le schéma JSON demandé. Renvoie uniquement un objet JSON valide, sans texte autour.',
        },
      ],
      maxTokens: 2000,
    });

    return parseLearningPath(retryAnswer);
  }
}

/**
 * Vérification légère de la disponibilité du service IA (utilisée par /admin).
 */
export async function checkAiHealth() {
  const startedAt = Date.now();

  try {
    await callChatCompletion({
      messages: [{ role: 'user', content: 'Réponds uniquement avec l’objet JSON {"ok":true}.' }],
      maxTokens: 5,
    });

    return { ok: true as const, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false as const,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}
