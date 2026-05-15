import type { CompletionRequestOptions, CompletionResult } from '../system/internals/protocols/types';
import { getEnabledCompletionSources } from '../system/internals/config/sources';

import { requestCopilotLmCompletion } from './copilot/copilotLmEngine';
import { requestOpencodeCompletion } from './opencode/opencodeLmEngine';
import { requestOllamaCompletion } from './ollama/ollamaLmEngine';

export interface CompletionProvider {
  readonly id: string;
  requestCompletion(userText: string, options: CompletionRequestOptions): Promise<CompletionResult>;
}

const copilotLmProvider: CompletionProvider = {
  id: 'copilotLm',
  requestCompletion: requestCopilotLmCompletion,
};

const opencodeProvider: CompletionProvider = {
  id: 'opencode',
  requestCompletion: requestOpencodeCompletion,
};

const ollamaProvider: CompletionProvider = {
  id: 'ollama',
  requestCompletion: requestOllamaCompletion,
};

/**
 * Obtiene el proveedor de completado para una fuente concreta.
 * @param {'copilot' | 'opencode' | 'ollama'} source Fuente de completado solicitada.
 * @returns {CompletionProvider} Proveedor de completado correspondiente a la fuente.
 */
export function getCompletionProviderForSource(
  source: 'copilot' | 'opencode' | 'ollama',
): CompletionProvider {
  if (source === 'opencode') {
    return opencodeProvider;
  }
  if (source === 'ollama') {
    return ollamaProvider;
  }
  return copilotLmProvider;
}

/**
 * Devuelve el proveedor de completado activo según la configuración.
 * @returns {CompletionProvider} Proveedor de completado seleccionado.
 */
export function getActiveCompletionProvider(): CompletionProvider {
  const sources = getEnabledCompletionSources();
  const source = sources.length === 1 ? sources[0] : 'copilot';
  return getCompletionProviderForSource(source);
}

/**
 * Devuelve el tipo de proveedor de completado activo.
 * @returns {'copilot' | 'opencode' | 'ollama'} Identificador de fuente activa de completado.
 */
export function getCompletionProviderKind(): 'copilot' | 'opencode' | 'ollama' {
  const s = getEnabledCompletionSources();
  if (s.length === 1) {
    return s[0];
  }
  return 'copilot';
}
