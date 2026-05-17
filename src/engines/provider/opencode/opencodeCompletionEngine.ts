/**
 * @file Motor de completions OpenCode: `CompletionResult` a partir del SDK y reglas GhostPrompt.
 */
import { fetchOpenCodeCompletionText, resolveOpenCodeModelId } from './opencodeCompletionFetch';
import { ensureOpenCodeClient, resetOpenCodeClient } from './opencodeSdkBootstrap';

import type {
  CompletionRequestOptions,
  CompletionResult,
  SuggestionModelDescriptor,
} from '../../../system/internals/protocols/types';

/**
 * Construye descriptor de modelo para mensajes al webview.
 * @param {string} modelId - Identificador del modelo OpenCode.
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
 * @param {string} userText - Texto del usuario.
 * @param {CompletionRequestOptions} options - Opciones de completado.
 * @returns {Promise<CompletionResult>} Sugerencia, vacío o error.
 */
export async function requestOpencodeCompletion(
  userText: string,
  options: CompletionRequestOptions,
): Promise<CompletionResult> {
  const {
    token,
    preferredModelId,
    requestTimeoutMs,
    onLoadingPhase,
  } = options;

  onLoadingPhase?.('opencode-start');

  if (!await ensureOpenCodeClient()) {
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

    if (!completionText) {
      return { kind: 'empty', reason: 'empty-response' };
    }

    return {
      kind: 'suggestion',
      suggestion: completionText,
      model: describeOpenCodeModel(modelId),
    };
  } catch (error) {
    if (token.isCancellationRequested) {
      return { kind: 'empty', reason: 'request-timeout' };
    }
    const message = error instanceof Error ? error.message : String(error);
    if (/timed out|cancelled/iu.test(message)) {
      return { kind: 'empty', reason: 'request-timeout' };
    }
    if (/econnrefused|fetch failed|not found|no model/iu.test(message)) {
      resetOpenCodeClient();
      return { kind: 'empty', reason: 'no-model' };
    }
    resetOpenCodeClient();
    return { kind: 'error', message };
  }
}
