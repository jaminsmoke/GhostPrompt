/**
 * @file Orquestación de completado OpenCode → CompletionResult.
 */
import { boundSuggestionText } from '../../../system/internals/protocols/types/boundSuggestionText';
import { DEFAULT_MAX_SUGGESTION_CHARS } from '../../../system/internals/protocols/types/params';

import {
  ensureOpenCodeClient,
  fetchOpenCodeCompletionText,
  resetOpenCodeClient,
  resolveOpenCodeModelId,
} from './opencodeCompletion';

import type {
  CompletionRequestOptions,
  CompletionResult,
  SuggestionModelDescriptor,
} from '../../../system/internals/protocols/types';

/**
 * Construye descriptor de modelo para mensajes al webview.
 * @param {string} modelId Identificador del modelo OpenCode.
 * @returns {SuggestionModelDescriptor} Descriptor para la UI.
 */
function describeOpenCodeModel(modelId: string): SuggestionModelDescriptor {
  return {
    id: modelId,
    label: modelId,
    tier: 'included',
    provider: 'opencode',
  };
}

/**
 * Solicita completado a OpenCode y devuelve el resultado del pipeline.
 * @param {string} userText Texto del usuario.
 * @param {CompletionRequestOptions} options Opciones de completado.
 * @returns {Promise<CompletionResult>} Sugerencia, vacío o error.
 */
export async function requestOpencodeCompletion(
  userText: string,
  options: CompletionRequestOptions,
): Promise<CompletionResult> {
  const {
    token,
    preferredModelId,
    maxSuggestionChars = DEFAULT_MAX_SUGGESTION_CHARS,
    requestTimeoutMs,
    onLoadingPhase,
  } = options;

  onLoadingPhase?.('opencode-start');

  if (!(await ensureOpenCodeClient())) {
    return { kind: 'empty', reason: 'no-model' };
  }

  const modelId = resolveOpenCodeModelId(preferredModelId);
  if (!modelId) {
    return { kind: 'empty', reason: 'no-model' };
  }

  try {
    const completionText = await fetchOpenCodeCompletionText(userText, modelId, {
      token,
      requestTimeoutMs,
      onLoadingPhase,
    });

    if (token.isCancellationRequested) {
      return { kind: 'empty', reason: 'request-timeout' };
    }

    const suggestion = boundSuggestionText(completionText, maxSuggestionChars);
    if (!suggestion) {
      return { kind: 'empty', reason: 'empty-response' };
    }

    return {
      kind: 'suggestion',
      suggestion,
      model: describeOpenCodeModel(modelId),
    };
  } catch (err) {
    if (token.isCancellationRequested) {
      return { kind: 'empty', reason: 'request-timeout' };
    }
    const message = err instanceof Error ? err.message : String(err);
    if (/timed out|cancelled/i.test(message)) {
      return { kind: 'empty', reason: 'request-timeout' };
    }
    if (/ECONNREFUSED|fetch failed|not found|no model/i.test(message)) {
      resetOpenCodeClient();
      return { kind: 'empty', reason: 'no-model' };
    }
    resetOpenCodeClient();
    return { kind: 'error', message };
  }
}
