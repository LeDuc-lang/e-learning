

export function estimerCoutUsd(promptTokens: number, completionTokens: number): number | null {
  const entree = Number(process.env.AI_PRICE_INPUT_PER_MTOK ?? 0);
  const sortie = Number(process.env.AI_PRICE_OUTPUT_PER_MTOK ?? 0);

  if (!Number.isFinite(entree) || !Number.isFinite(sortie) || entree < 0 || sortie < 0) {
    return null;
  }

  if (entree === 0 && sortie === 0) {
    return null;
  }

  return (promptTokens * entree + completionTokens * sortie) / 1_000_000;
}
