/**
 * Catálogo unificado cuando hay varias fuentes habilitadas.
 * Ver `Docs/ARCHITECTURE.md` §3 — Catálogo OpenCode y merge.
 * @returns Lista de descriptores de modelo disponibles según política y fuentes.
 */
import type { SuggestionModelDescriptor, SuggestionModelPolicy } from "../types";
import { listSuggestionModels } from "../../engines/copilot/catalog/modelCatalog";
import { listOpencodeSuggestionModels } from "../../engines/opencode/catalog/opencodeModelCatalog";
import { listOllamaSuggestionModels } from "../../engines/ollama/catalog/ollamaModelCatalog";
import type { CompletionSourceId } from "../sources";

/**
 * Concatena modelos Copilot + OpenCode + Ollama; deduplica por `id` (prioriza el primero: Copilot).
 * @param policy
 * @param sources
 * @returns Lista de descriptores de modelo fusionada y deduplicada.
 */
export async function listMergedSuggestionModels(
  policy: SuggestionModelPolicy,
  sources: readonly CompletionSourceId[],
): Promise<SuggestionModelDescriptor[]> {
  const merged: SuggestionModelDescriptor[] = [];
  if (sources.includes("copilot")) {
    merged.push(...(await listSuggestionModels(policy)));
  }
  if (sources.includes("opencode")) {
    merged.push(...(await listOpencodeSuggestionModels(policy)));
  }
  if (sources.includes("ollama")) {
    merged.push(...(await listOllamaSuggestionModels(policy)));
  }

  const seen = new Set<string>();
  const deduped: SuggestionModelDescriptor[] = [];
  for (const d of merged) {
    if (seen.has(d.id)) {
      continue;
    }
    seen.add(d.id);
    deduped.push(d);
  }
  return deduped;
}