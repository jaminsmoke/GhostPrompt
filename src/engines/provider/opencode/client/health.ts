/**
 * @file Health check del cliente SDK OpenCode.
 */
import { getGlobalClient } from './clientSingleton';

import type { OpenCodeSdkClient } from '../../../../system/internals/protocols/types/typeOpencodeClient';

/**
 * Verifica la salud de la conexión OpenCode vía `config.get()` del SDK.
 * @param {OpenCodeSdkClient} [client] - Cliente OpenCode opcional; usa el global si no se pasa.
 * @returns {Promise<boolean>} True si la conexión es válida.
 */
export async function healthCheck(client?: OpenCodeSdkClient): Promise<boolean> {
  const c = client ?? getGlobalClient();
  try {
    await c.config.get();
    return true;
  } catch {
    return false;
  }
}
