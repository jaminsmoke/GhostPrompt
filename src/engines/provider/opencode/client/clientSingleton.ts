/**
 * @file Singleton del cliente SDK OpenCode en el proceso de la extensión.
 */
import type { OpenCodeSdkClient } from '../../../../system/internals/protocols/types/opencodeClient';

let globalClient: OpenCodeSdkClient | undefined;

/**
 * Registra el cliente global (uso interno tras `createOpenCodeClient`).
 * @param {OpenCodeSdkClient} client Instancia del SDK.
 */
export function setGlobalOpenCodeClient(client: OpenCodeSdkClient): void {
  globalClient = client;
}

/**
 * Devuelve la instancia global del cliente OpenCode.
 * @returns {OpenCodeSdkClient} Cliente inicializado.
 * @throws {Error} Si el cliente no está inicializado.
 */
export function getGlobalClient(): OpenCodeSdkClient {
  if (!globalClient) {
    throw new Error('OpenCode client no inicializado. Llama a createOpenCodeClient primero.');
  }
  return globalClient;
}

/**
 * Indica si hay un cliente global registrado.
 * @returns {boolean} `true` si `createOpenCodeClient` ya registró un cliente global.
 */
export function hasGlobalClient(): boolean {
  return globalClient !== undefined;
}

/**
 * Elimina la referencia al cliente global.
 */
export function resetGlobalClient(): void {
  globalClient = undefined;
}
