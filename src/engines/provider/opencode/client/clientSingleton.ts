/**
 * @file Singleton del cliente SDK OpenCode en el proceso de la extensión.
 */
import {
  clearOptionalProperty,
  isDefined,
} from '../../../../system/internals/isDefined';

import type { OpenCodeSdkClient } from '../../../../system/internals/protocols/types/typeOpencodeClient';

const openCodeClientSlot: { current?: OpenCodeSdkClient } = {};

/**
 * Registra el cliente global (uso interno tras `createOpenCodeClient`).
 * @param {OpenCodeSdkClient} client - Instancia del SDK.
 */
export function setGlobalOpenCodeClient(client: OpenCodeSdkClient): void {
  openCodeClientSlot.current = client;
}

/**
 * Devuelve la instancia global del cliente OpenCode.
 * @returns {OpenCodeSdkClient} Cliente inicializado.
 * @throws {Error} Si el cliente no está inicializado.
 */
export function getGlobalClient(): OpenCodeSdkClient {
  if (!openCodeClientSlot.current) {
    throw new Error('OpenCode client no inicializado. Llama a createOpenCodeClient primero.');
  }
  return openCodeClientSlot.current;
}

/**
 * Indica si hay un cliente global registrado.
 * @returns {boolean} `true` si `createOpenCodeClient` ya registró un cliente global.
 */
export function hasGlobalClient(): boolean {
  return isDefined(openCodeClientSlot.current);
}

/**
 * Elimina la referencia al cliente global.
 */
export function resetGlobalClient(): void {
  clearOptionalProperty(openCodeClientSlot, 'current');
}
