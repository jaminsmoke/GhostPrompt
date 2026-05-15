import * as vscode from 'vscode';

import { buildCompletionInstruction } from '../../core/prompt/instruction';
import { normalizeSuggestion } from '../../core/prompt/normalize';
import {
  DEFAULT_MAX_SUGGESTION_CHARS,
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
  type CompletionRequestOptions,
  type CompletionResult,
  type SuggestionModelDescriptor,
} from '../../core/types';
import { listModels, generate } from './ollamaApiClient';

/**
 * Describe un modelo Ollama para el pipeline de sugerencias.
 * @param {string} modelName Nombre del modelo Ollama.
 * @returns {SuggestionModelDescriptor} Descriptor de modelo para sugerencias.
 */
function describeOllamaModel(modelName: string): SuggestionModelDescriptor {
  return {
    id: modelName,
    label: modelName,
    tier: 'included',
    provider: 'ollama',
  };
}

/**
 * Resuelve el modelo Ollama a usar según preferencia y configuración.
 * @param {string | undefined} preferredModelId Modelo preferido o "auto".
 * @returns {Promise<string | undefined>} Nombre del modelo seleccionado o undefined.
 */
async function resolveOllamaModel(
  preferredModelId: string | undefined,
): Promise<string | undefined> {
  if (preferredModelId && preferredModelId !== 'auto') {
    return preferredModelId;
  }

  const cfg = vscode.workspace.getConfiguration('ghostPrompt');
  const baseUrl = cfg.get<string>('ollamaBaseUrl', 'http://localhost:11434');
  const excluded = new Set(cfg.get<string[]>('ollamaExcludedModelIds', []));
  try {
    const models = await listModels({ baseUrl });
    const available = models.map((m) => m.name).filter((name) => !excluded.has(name));
    return available.length > 0 ? available[0] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Solicita una completación a Ollama para un texto de usuario.
 * @param {string} userText Texto del usuario a completar.
 * @param {CompletionRequestOptions} options Opciones de completion del pipeline.
 * @returns {Promise<CompletionResult>} Resultado de completion con sugerencia o error.
 */
export async function requestOllamaCompletion(
  userText: string,
  options: CompletionRequestOptions,
): Promise<CompletionResult> {
  const {
    token,
    preferredModelId,
    maxSuggestionChars = DEFAULT_MAX_SUGGESTION_CHARS,
    style = 'balanced',
    context,
    requestTimeoutMs = DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
    onLoadingPhase,
    onStreamPreview,
  } = options;

  onLoadingPhase?.('ollama-start');

  const modelName = await resolveOllamaModel(preferredModelId);
  if (!modelName) {
    return { kind: 'empty', reason: 'no-model' };
  }

  const baseUrl = vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<string>('ollamaBaseUrl', 'http://localhost:11434');
  const instruction = buildCompletionInstruction(userText, style, context);

  onLoadingPhase?.('ollama-loading');

  onLoadingPhase?.('ollama-generating');

  const abortController = new AbortController();
  const cancellationListener = token.onCancellationRequested(() => {
    abortController.abort();
  });

  try {
    if (token.isCancellationRequested) {
      abortController.abort();
    }

    const completionText = await generate(instruction, modelName, {
      baseUrl,
      requestTimeoutMs,
      signal: abortController.signal,
      onStreamPreview: onStreamPreview ? (text: string) => onStreamPreview(text) : undefined,
    });

    if (token.isCancellationRequested) {
      return { kind: 'empty', reason: 'request-timeout' };
    }

    const suggestion = normalizeSuggestion(completionText, userText, maxSuggestionChars);

    if (!suggestion) {
      return { kind: 'empty', reason: 'empty-response' };
    }

    return {
      kind: 'suggestion',
      suggestion,
      model: describeOllamaModel(modelName),
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
      return { kind: 'empty', reason: 'no-model' };
    }
    return { kind: 'error', message };
  } finally {
    cancellationListener.dispose();
  }
}
