/**
 * @file I/O de completado OpenCode (cliente, sesión, prompt).
 */
import { buildCompletionInstruction } from '../../../sugcore/rules/instruction';

import {
  createOpenCodeClient,
  getGlobalClient,
  getSession,
  healthCheck,
  promptOpenCode,
  resetClient,
} from './client';
import { getOpenCodeClientOptions } from './server/opencodeServerManager';

import type { CompletionRequestOptions } from '../../../system/internals/protocols/types';

/**
 * Asegura cliente OpenCode inicializado y saludable.
 * @returns {Promise<boolean>} True si el cliente responde al health check.
 */
export async function ensureOpenCodeClient(): Promise<boolean> {
  try {
    const client = await createOpenCodeClient(getOpenCodeClientOptions());
    return await healthCheck(client);
  } catch {
    return false;
  }
}

/**
 * Resuelve el id de modelo a usar (sin auto-selección por ahora).
 * @param {string | undefined} preferredModelId Modelo preferido o `auto`.
 * @returns {string | undefined} Id de modelo o undefined.
 */
export function resolveOpenCodeModelId(preferredModelId: string | undefined): string | undefined {
  if (preferredModelId && preferredModelId !== 'auto') {
    return preferredModelId;
  }
  return undefined;
}

/**
 * Ejecuta prompt OpenCode y devuelve el texto bruto del LM.
 * @param {string} userText Texto del usuario.
 * @param {string} modelId Identificador del modelo OpenCode.
 * @param {Pick<CompletionRequestOptions, 'token' | 'requestTimeoutMs' | 'onLoadingPhase'>} options Opciones de la petición.
 * @returns {Promise<string>} Texto de completion sin post-proceso.
 * @throws {Error} En timeout, cancelación o fallo de red.
 */
export async function fetchOpenCodeCompletionText(
  userText: string,
  modelId: string,
  options: Pick<CompletionRequestOptions, 'token' | 'requestTimeoutMs' | 'onLoadingPhase'>,
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

/**
 * Reinicia cliente y sesiones tras error de conexión.
 */
export function resetOpenCodeClient(): void {
  resetClient();
}
