/**
 * @file Barrel del cliente SDK OpenCode.
 */
export {
  OPENCODE_DEFAULT_PORT,
  type OpenCodeClientOptions,
  type OpenCodeSdkClient,
} from '../../../../system/internals/protocols/types/typeOpencodeClient';

export { createOpenCodeClient } from './createClient';
export { getGlobalClient, hasGlobalClient, resetGlobalClient } from './clientSingleton';
export { healthCheck } from './health';
export { getSession, closeAllSessions, clearSessionPool } from './sessionPool';
export { promptOpenCode } from './prompt';
export { promptStreamOpenCode } from './stream';

import { resetGlobalClient } from './clientSingleton';
import { clearSessionPool } from './sessionPool';

/**
 * Reinicia el cliente OpenCode global y el pool de sesiones.
 */
export function resetClient(): void {
  resetGlobalClient();
  clearSessionPool();
}
