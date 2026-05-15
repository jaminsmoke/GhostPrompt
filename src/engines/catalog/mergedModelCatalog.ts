/**
 * Catálogo unificado cuando hay varias fuentes habilitadas (UI / settings).
 * Vive bajo `engines/` porque compone los listados de cada motor; no forma parte del
 * hot path de `suggest`. Ver `Docs/ARCHITECTURE.md` y `Docs/Plans/Roadmaps/v0.6/`.
 */
import type { SuggestionModelDescriptor, SuggestionModelPolicy } from '../../system/internals/protocols/types';
import type { CompletionSourceId } from '../../system/internals/protocols/routing';
import { listSuggestionModels } from '../copilot/catalog/modelCatalog';
import { listOpencodeSuggestionModels } from '../opencode/catalog/opencodeModelCatalog';
import { listOllamaSuggestionModels } from '../ollama/catalog/ollamaModelCatalog';

/**
 * Concatena modelos Copilot + OpenCode + Ollama; deduplica por `id` (prioriza el primero: Copilot).
 * @param {SuggestionModelPolicy} policy Política para filtrar modelos de cada fuente.
 * @param {readonly CompletionSourceId[]} sources Fuentes de completado habilitadas a consultar.
 * @returns {Promise<SuggestionModelDescriptor[]>} Lista de descriptores de modelo fusionada y deduplicada.
 */
export async function listMergedSuggestionModels(
  policy: SuggestionModelPolicy,
  sources: readonly CompletionSourceId[],
): Promise<SuggestionModelDescriptor[]> {
  const merged: SuggestionModelDescriptor[] = [];
  if (sources.includes('copilot')) {
    merged.push(...(await listSuggestionModels(policy)));
  }
  if (sources.includes('opencode')) {
    merged.push(...(await listOpencodeSuggestionModels(policy)));
  }
  if (sources.includes('ollama')) {
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
