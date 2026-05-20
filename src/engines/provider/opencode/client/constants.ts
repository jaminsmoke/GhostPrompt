/**
 * @file Constantes del pool de sesiones OpenCode.
 */

const OPENCODE_SESSION_TTL_MINUTES = 5;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

/** TTL de sesiones en el pool antes de expirar. */
export const OPENCODE_SESSION_POOL_TTL_MS =
  OPENCODE_SESSION_TTL_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;

/** Máximo de sesiones simultáneas en el pool. */
export const OPENCODE_SESSION_POOL_MAX_SIZE = 4;
