/**
 * @file Bootstrap del cliente SDK OpenCode en el host (crear, health, reset).
 */
import { createOpenCodeClient, healthCheck, resetClient } from './client';
import { getOpenCodeClientOptions } from './server/opencodeServerManager';

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
 * Reinicia cliente y sesiones tras error de conexión.
 */
export function resetOpenCodeClient(): void {
  resetClient();
}
