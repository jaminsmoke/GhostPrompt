/**
 * @file Resuelve el adaptador LM de un proveedor (copilot, opencode, ollama).
 */
import { requestCopilotLmCompletion } from '../provider/copilot/completion/copilotCompletionEngine';
import { requestOllamaCompletion } from '../provider/ollama/completion/ollamaCompletionEngine';
import { requestOpencodeCompletion } from '../provider/opencode/opencodeCompletionEngine';

import type { ProviderId } from '../../system/internals/protocols/state/provider';
import type { CompletionRequestOptions, CompletionResult } from '../../system/internals/protocols/types';

/** Adaptador de un proveedor LM dentro del dominio engines. */
export interface EngineProvider {
  readonly id: string;
  requestCompletion(userText: string, options: CompletionRequestOptions): Promise<CompletionResult>;
}

const copilotLmProvider: EngineProvider = {
  id: 'copilotLm',
  requestCompletion: requestCopilotLmCompletion,
};

const opencodeProvider: EngineProvider = {
  id: 'opencode',
  requestCompletion: requestOpencodeCompletion,
};

const ollamaProvider: EngineProvider = {
  id: 'ollama',
  requestCompletion: requestOllamaCompletion,
};

/**
 * Devuelve el adaptador LM del proveedor indicado.
 * @param {ProviderId} source Identificador del proveedor.
 * @returns {EngineProvider} Adaptador con `requestCompletion` del motor correspondiente.
 */
export function resolveProvider(source: ProviderId): EngineProvider {
  if (source === 'opencode') {
    return opencodeProvider;
  }
  if (source === 'ollama') {
    return ollamaProvider;
  }
  return copilotLmProvider;
}
