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

export interface AiCallResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

export interface AiUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  attempts: number;
}

export interface AiGenerationResult {
  data: LearningPathData;
  usage: AiUsage;
}

async function callChatCompletion({
  messages,
  maxTokens = 2000,
}: ChatCompletionOptions): Promise<AiCallResult> {
  const config = getAiConfig();
  const debut = Date.now();

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

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Authentification du fournisseur IA refusée (${response.status}). Vérifiez que AI_API_KEY correspond bien à AI_BASE_URL (OpenAI, Groq, etc.).`
      );
    }

    throw new Error(`Le modèle IA a répondu ${response.status}. ${details.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Le modèle IA n'a renvoyé aucun contenu.");
  }

  return {
    content,
    model: config.model,
    promptTokens: payload.usage?.prompt_tokens ?? 0,
    completionTokens: payload.usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - debut,
  };
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
export async function generateLearningPath(
  input: LearningPathRequest
): Promise<AiGenerationResult> {
  const messages: ChatCompletionOptions['messages'] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(input) },
  ];

  const premierAppel = await callChatCompletion({ messages });

  try {
    return {
      data: parseLearningPath(premierAppel.content),
      usage: {
        model: premierAppel.model,
        promptTokens: premierAppel.promptTokens,
        completionTokens: premierAppel.completionTokens,
        latencyMs: premierAppel.latencyMs,
        attempts: 1,
      },
    };
  } catch {
    const secondAppel = await callChatCompletion({
      messages: [
        ...messages,
        { role: 'assistant', content: premierAppel.content },
        {
          role: 'user',
          content:
            'Ta réponse précédente ne respecte pas le schéma JSON demandé. Renvoie uniquement un objet JSON valide, sans texte autour.',
        },
      ],
      maxTokens: 2000,
    });

    return {
      data: parseLearningPath(secondAppel.content),
      usage: {
        model: secondAppel.model,
        promptTokens: premierAppel.promptTokens + secondAppel.promptTokens,
        completionTokens: premierAppel.completionTokens + secondAppel.completionTokens,
        latencyMs: premierAppel.latencyMs + secondAppel.latencyMs,
        attempts: 2,
      },
    };
  }
}
