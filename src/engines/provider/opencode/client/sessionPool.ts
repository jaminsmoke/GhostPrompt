/**
 * @file Pool de sesiones OpenCode (TTL + tamaño máximo).
 */
import { getGlobalClient, hasGlobalClient } from './clientSingleton';
import { OPENCODE_SESSION_POOL_MAX_SIZE, OPENCODE_SESSION_POOL_TTL_MS } from './constants';
import { extractSessionId } from './parseSdkResponse';

import type { OpenCodeSdkClient } from '../../../../system/internals/protocols/types/opencodeClient';

interface PoolEntry {
  sessionId: string;
  lastUsed: number;
}

let sessionPool: PoolEntry[] = [];

/**
 * Crea una sesión nueva en el servidor OpenCode.
 * @param {OpenCodeSdkClient} client Cliente SDK.
 * @returns {Promise<string>} ID de la sesión creada.
 */
async function createSessionInternal(client: OpenCodeSdkClient): Promise<string> {
  const result = await client.session.create();
  return extractSessionId(result);
}

/**
 * Elimina una sesión en el servidor OpenCode.
 * @param {string} sessionId ID de sesión.
 * @param {OpenCodeSdkClient} client Cliente SDK.
 */
async function deleteSessionInternal(sessionId: string, client: OpenCodeSdkClient): Promise<void> {
  await client.session.delete({
    path: { id: sessionId },
  });
}

/**
 * Indica si una entrada del pool superó el TTL.
 * @param {PoolEntry} entry Entrada del pool.
 * @returns {boolean} `true` si la entrada expiró.
 */
function isSessionStale(entry: PoolEntry): boolean {
  return Date.now() - entry.lastUsed > OPENCODE_SESSION_POOL_TTL_MS;
}

/** Elimina sesiones expiradas del pool y del servidor. */
function evictStaleSessions(): void {
  if (!hasGlobalClient()) {
    sessionPool = [];
    return;
  }
  const client = getGlobalClient();
  sessionPool = sessionPool.filter((e) => {
    if (isSessionStale(e)) {
      deleteSessionInternal(e.sessionId, client).catch(() => {});
      return false;
    }
    return true;
  });
}

/**
 * Obtiene una sesión OpenCode reutilizando una existente o creando una nueva.
 * @param {OpenCodeSdkClient} [client] Cliente OpenCode opcional.
 * @returns {Promise<string>} ID de sesión disponible.
 */
export async function getSession(client?: OpenCodeSdkClient): Promise<string> {
  evictStaleSessions();
  const c = client ?? getGlobalClient();
  const pooled = sessionPool.find((e) => !isSessionStale(e));
  if (pooled) {
    pooled.lastUsed = Date.now();
    return pooled.sessionId;
  }
  if (sessionPool.length >= OPENCODE_SESSION_POOL_MAX_SIZE) {
    const oldest = sessionPool.reduce((a, b) => (a.lastUsed < b.lastUsed ? a : b));
    await deleteSessionInternal(oldest.sessionId, c);
    sessionPool = sessionPool.filter((e) => e !== oldest);
  }
  const sessionId = await createSessionInternal(c);
  sessionPool.push({ sessionId, lastUsed: Date.now() });
  return sessionId;
}

/**
 * Cierra todas las sesiones OpenCode activas en la piscina.
 * @param {OpenCodeSdkClient} [client] Cliente OpenCode opcional.
 */
export async function closeAllSessions(client?: OpenCodeSdkClient): Promise<void> {
  const c = client ?? getGlobalClient();
  await Promise.all(sessionPool.map((e) => deleteSessionInternal(e.sessionId, c)));
  sessionPool = [];
}

/**
 * Vacía el pool de sesiones (sin llamar al SDK).
 */
export function clearSessionPool(): void {
  sessionPool = [];
}
