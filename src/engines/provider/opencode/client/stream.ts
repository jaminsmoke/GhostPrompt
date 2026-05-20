/**
 * @file Stream SSE de eventos OpenCode (preview incremental).
 */
import { getGlobalClient } from './clientSingleton';
import { extractDeltaText } from './parseSdkResponse';

import type { OpenCodeSdkClient } from '../../../../system/internals/protocols/types/typeOpencodeClient';

/**
 * Crea un stream de texto para una sesión OpenCode.
 * @param {string} _sessionId - ID de sesión de OpenCode.
 * @param {globalThis.AbortSignal} signal - Señal de abort para cancelar el stream.
 * @param {OpenCodeSdkClient} [client] - Cliente OpenCode opcional.
 * @yields {string} Fragmentos de texto incremental del stream OpenCode.
 */
export async function* promptStreamOpenCode(
  _sessionId: string,
  signal: AbortSignal,
  client?: OpenCodeSdkClient,
): AsyncGenerator<string> {
  const c = client ?? getGlobalClient();
  const { stream } = await c.event.subscribe({ signal });
  for await (const data of stream) {
    const text = extractDeltaText(data);
    if (text) {
      yield text;
    }
  }
}
