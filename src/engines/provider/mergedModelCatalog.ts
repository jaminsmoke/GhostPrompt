/**
 * @file Catálogo unificado de modelos cuando varios proveedores están habilitados.
 * Compone los listados de `copilot/`, `opencode/` y `ollama/`; no es hot path de suggest.
 */
import { listSuggestionModels } from './copilot/catalog/modelCatalog';
import { listOllamaSuggestionModels } from './ollama/catalog/ollamaModelCatalog';
import { listOpencodeSuggestionModels } from './opencode/catalog/opencodeModelCatalog';

import type { ProviderId } from '../../system/internals/protocols/state/provider';
import type { SuggestionModelDescriptor, SuggestionModelPolicy } from '../../system/internals/protocols/types';

/**
 * Concatena modelos Copilot + OpenCode + Ollama; deduplica por `id` (prioriza el primero: Copilot).
 * @param {SuggestionModelPolicy} policy - Política para filtrar modelos de cada proveedor.
 * @param {readonly ProviderId[]} sources - Proveedores habilitados a consultar.
 * @returns {Promise<SuggestionModelDescriptor[]>} Lista fusionada y deduplicada.
 */
export async function listMergedSuggestionModels(
  policy: SuggestionModelPolicy,
  sources: readonly ProviderId[],
): Promise<SuggestionModelDescriptor[]> {
  const merged: SuggestionModelDescriptor[] = [];
  if (sources.includes('copilot')) {
    merged.push(...await listSuggestionModels(policy));
  }
  if (sources.includes('opencode')) {
    merged.push(...await listOpencodeSuggestionModels(policy));
  }
  if (sources.includes('ollama')) {
    merged.push(...await listOllamaSuggestionModels(policy));
  }

  const seen = new Set<string>();
  const deduped: SuggestionModelDescriptor[] = [];
  for (const d of merged) {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      deduped.push(d);
    }
  }
  return deduped;
}
