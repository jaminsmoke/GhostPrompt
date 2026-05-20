/**
 * @file Recolecta texto incremental desde `vscode.LanguageModelChatResponse` (Copilot LM).
 */
import { DEFAULT_MODEL_REQUEST_TIMEOUT_MS } from '../../../../system/internals/protocols/constants/consPipelineDefaults';

import type * as vscode from 'vscode';

/**
 * Espera un fragmento del iterador de texto o expira si se supera el timeout.
 * @param {AsyncIterator<string>} iterator - Iterador asíncrono que produce trozos de texto.
 * @param {number} timeoutMs - Tiempo de espera en milisegundos antes de cancelar.
 * @returns {Promise<IteratorResult<string>>} El siguiente resultado del iterador.
 */
async function awaitNextChunkWithTimeout(
  iterator: AsyncIterator<string>,
  timeoutMs: number,
): Promise<IteratorResult<string>> {
  const timeoutState = { handle: false as ReturnType<typeof setTimeout> | false };
  try {
    return await Promise.race([
      iterator.next(),
      new Promise<IteratorResult<string>>((_, reject) => {
        timeoutState.handle = setTimeout(() => {
          reject(new Error('request-timeout'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutState.handle !== false) {
      clearTimeout(timeoutState.handle);
    }
  }
}

/**
 * Recompone el texto completo de la respuesta de Copilot LM a partir del stream de VS Code.
 * @param {vscode.LanguageModelChatResponse} response - Respuesta de chat de la API de lenguaje de VS Code.
 * @param {number} timeoutMs - Tiempo máximo en milisegundos para esperar el siguiente fragmento.
 * @returns {Promise<string>} Texto acumulado de la respuesta.
 */
export async function collectLmResponse(
  response: vscode.LanguageModelChatResponse,
  timeoutMs: number = DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
): Promise<string> {
  const iterator = response.text[Symbol.asyncIterator]();

  const collectNext = async (completion: string): Promise<string> => {
    const nextChunk = await awaitNextChunkWithTimeout(iterator, timeoutMs);
    if (nextChunk.done) {
      return completion;
    }
    return collectNext(completion + nextChunk.value);
  };

  return collectNext('');
}
