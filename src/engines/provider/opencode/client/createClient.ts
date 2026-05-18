/**
 * @file Factory del cliente SDK OpenCode.
 */
import { OPENCODE_DEFAULT_PORT } from '../../../../system/internals/protocols/constants/consOpencodeClient';

import { setGlobalOpenCodeClient } from './clientSingleton';

import type { OpenCodeClientOptions, OpenCodeSdkClient } from '../../../../system/internals/protocols/types/typeOpencodeClient';


/**
 * Construye la URL base del cliente OpenCode.
 * @param {OpenCodeClientOptions} options - Opciones de cliente que incluyen host y puerto.
 * @returns {string} URL base HTTP.
 */
function buildBaseUrl(options: OpenCodeClientOptions): string {
  const hostname = options.hostname ?? '127.0.0.1';
  const port = options.port ?? OPENCODE_DEFAULT_PORT;
  return `http://${hostname}:${port}`;
}

/**
 * Construye las cabeceras HTTP para el cliente OpenCode.
 * @param {OpenCodeClientOptions} options - Opciones que pueden incluir token de autenticación.
 * @returns {Record<string, string>} Cabeceras de petición.
 */
function buildHeaders(options: OpenCodeClientOptions): Record<string, string> {
  const headers: Record<string, string> = {};
  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }
  return headers;
}

/**
 * Crea e inicializa el cliente OpenCode SDK y lo registra como global.
 * @param {OpenCodeClientOptions} options - Opciones de configuración de cliente.
 * @returns {Promise<OpenCodeSdkClient>} Instancia de cliente OpenCode.
 */
export async function createOpenCodeClient(
  options: OpenCodeClientOptions,
): Promise<OpenCodeSdkClient> {
  const baseUrl = buildBaseUrl(options);
  const headers = buildHeaders(options);
  const { createOpencodeClient: factory } = await import('@opencode-ai/sdk');
  const client = factory({ baseUrl, headers }) as OpenCodeSdkClient;
  setGlobalOpenCodeClient(client);
  return client;
}
