/**
 * Coût estimé d'un appel IA à partir des tarifs au million de tokens.
 *
 * Les tarifs dépendent du fournisseur et du modèle : ils sont donc lus dans
 * l'environnement plutôt que codés en dur. Sans tarif configuré, on renvoie
 * `null` (l'interface affiche « — » plutôt qu'un faux 0 $).
 */
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
