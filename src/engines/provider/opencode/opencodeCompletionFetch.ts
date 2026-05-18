/**
 * @file Fetch de texto bruto de completion OpenCode vía SDK (instrucción GhostPrompt + sesión + timeout).
 */
import { buildCompletionInstruction } from '../../completion/buildCompletionInstruction';

import { getGlobalClient, getSession, promptOpenCode } from './client';

import type { CompletionRequestOptions } from '../../../system/internals/protocols/types';

/**
 * Resuelve el id de modelo a usar (sin auto-selección por ahora).
 * @param {string | undefined} preferredModelId - Modelo preferido o `auto`.
 * @returns {string | undefined} Id de modelo o undefined.
 */
export function resolveOpenCodeModelId(preferredModelId: string | undefined): string | false {
  if (preferredModelId && preferredModelId !== 'auto') {
    return preferredModelId;
  }
  return false;
}

/**
 * Ejecuta prompt OpenCode y devuelve el texto bruto del LM.
 * @param {string} userText - Texto del usuario.
 * @param {string} modelId - Identificador del modelo OpenCode.
 * @param {object} options - Opciones de la petición (token, timeout, fases).
 * @returns {Promise<string>} Texto de completion sin post-proceso.
 * @throws {Error} En timeout, cancelación o fallo de red.
 */
export async function fetchOpenCodeCompletionText(
  userText: string,
  modelId: string,
  options: Pick<CompletionRequestOptions, 'onLoadingPhase' | 'requestTimeoutMs' | 'token'>,
): Promise<string> {
  const { token, requestTimeoutMs = 30_000, onLoadingPhase } = options;

  onLoadingPhase?.('opencode-generating');

  const client = getGlobalClient();
  const sessionId = await getSession(client);
  const instruction = buildCompletionInstruction(userText);

  return Promise.race([
    promptOpenCode(
      sessionId,
      { providerID: 'opencode', modelID: modelId },
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
}
