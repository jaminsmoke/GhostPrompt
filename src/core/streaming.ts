import * as vscode from 'vscode';

import { DEFAULT_MODEL_REQUEST_TIMEOUT_MS } from './types';

/**
 * Recompone el texto completo de la respuesta de Copilot/LM a partir del stream.
 * @param response Respuesta de chat de la API de lenguaje de VS Code.
 * @param timeoutMs Tiempo máximo en milisegundos para esperar el siguiente fragmento.
 * @returns Texto acumulado de la respuesta.
 */
export async function collectResponseText(
  response: vscode.LanguageModelChatResponse,
  timeoutMs: number = DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
): Promise<string> {
  let completion = '';
  const iterator = response.text[Symbol.asyncIterator]();
  while (true) {
    const nextChunk = await awaitNextChunkWithTimeout(iterator, timeoutMs);
    if (nextChunk.done) {
      break;
    }
    completion += nextChunk.value;
  }
  return completion;
}

/**
 * Espera un fragmento del iterador de texto o expira si se supera el timeout.
 * @param iterator Iterador asíncrono que produce trozos de texto.
 * @param timeoutMs Tiempo de espera en milisegundos antes de cancelar.
 * @returns El siguiente resultado del iterador.
 */
async function awaitNextChunkWithTimeout(
  iterator: AsyncIterator<string>,
  timeoutMs: number,
): Promise<IteratorResult<string>> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      iterator.next(),
      new Promise<IteratorResult<string>>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error('request-timeout'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
