import * as vscode from 'vscode';

import { buildCompletionInstruction } from '../../sugcore/rules/instruction';
import {
  DEFAULT_MAX_SUGGESTION_CHARS,
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
} from '../../system/internals/protocols/params';
import type {
  CompletionRequestOptions,
  CompletionResult,
  SuggestionModelDescriptor,
} from '../../system/internals/protocols/types';
import {
  createOpenCodeClient,
  getGlobalClient,
  healthCheck,
  promptOpenCode,
  resetClient,
  getSession,
} from './opencodeApiClient';

/**
 * Describe un modelo OpenCode para el pipeline de sugerencias.
 * @param {string} modelId Identificador del modelo OpenCode.
 * @returns {SuggestionModelDescriptor} Descriptor de modelo adecuado para la UI.
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
 * Resuelve el modelo OpenCode a usar según la preferencia y configuración.
 * @param {string | undefined} preferredModelId ID de modelo preferido o "auto".
 * @returns {Promise<string | undefined>} Modelo seleccionado o undefined si no se encuentra ninguno.
 */
async function resolveOpenCodeModel(
  preferredModelId: string | undefined,
): Promise<string | undefined> {
  if (preferredModelId && preferredModelId !== 'auto') {
    return preferredModelId;
  }
  return undefined;
}

/**
 * Asegura que el cliente OpenCode esté inicializado y disponible.
 * @returns {Promise<boolean>} True si el cliente es válido y responde.
 */
async function ensureClient(): Promise<boolean> {
  const cfg = vscode.workspace.getConfiguration('ghostPrompt');
  const port = cfg.get<number>('opencodePort');
  const authToken = cfg.get<string>('opencodeAuthToken');

  try {
    const client = await createOpenCodeClient({
      port,
      authToken,
    });
    return await healthCheck(client);
  } catch {
    return false;
  }
}

/**
 * Envía una solicitud de completado a OpenCode y normaliza la respuesta.
 * @param {string} userText Texto de usuario usado para construir el prompt.
 * @param {CompletionRequestOptions} options Opciones de solicitud de completado.
 * @returns {Promise<CompletionResult>} Resultado de completado o un motivo vacío.
 */
export async function requestOpencodeCompletion(
  userText: string,
  options: CompletionRequestOptions,
): Promise<CompletionResult> {
  const {
    token,
    preferredModelId,
    maxSuggestionChars = DEFAULT_MAX_SUGGESTION_CHARS,
    style: _style,
    context: _context,
    requestTimeoutMs = DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
    onLoadingPhase,
    onStreamPreview: _onStreamPreview,
  } = options;

  onLoadingPhase?.('opencode-start');

  const alive = await ensureClient();
  if (!alive) {
    return { kind: 'empty', reason: 'no-model' };
  }

  const modelName = await resolveOpenCodeModel(preferredModelId);
  if (!modelName) {
    return { kind: 'empty', reason: 'no-model' };
  }

  const client = getGlobalClient();
  const instruction = buildCompletionInstruction(userText);

  try {
    const sessionId = await getSession(client);

    onLoadingPhase?.('opencode-generating');
    const completionText = await Promise.race([
      promptOpenCode(
        sessionId,
        { providerID: 'opencode', modelID: modelName },
        [{ type: 'text', text: instruction }],
        client,
      ),
      new Promise<string>((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error('request-timed-out'));
        }, requestTimeoutMs);
        if (token.isCancellationRequested) {
          clearTimeout(id);
          reject(new Error('request-cancelled'));
        }
      }),
    ]);

    if (token.isCancellationRequested) {
      return { kind: 'empty', reason: 'request-timeout' };
    }

    const suggestion = completionText.trimEnd().slice(0, maxSuggestionChars).trimEnd();

    if (!suggestion) {
      return { kind: 'empty', reason: 'empty-response' };
    }

    return {
      kind: 'suggestion',
      suggestion,
      model: describeOpenCodeModel(modelName),
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
      resetClient();
      return { kind: 'empty', reason: 'no-model' };
    }
    resetClient();
    return { kind: 'error', message };
  }
}
