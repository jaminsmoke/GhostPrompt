/**
 * @file Prompt síncrono OpenCode (session.prompt).
 */
import { getGlobalClient } from './clientSingleton';
import { extractPromptText } from './parseSdkResponse';

import type { OpenCodeSdkClient } from '../../../../system/internals/protocols/types/opencodeClient';

/**
 * Envía un prompt de OpenCode a una sesión existente.
 * @param {string} sessionId ID de la sesión de OpenCode.
 * @param {{ providerID: string; modelID: string }} model Modelo objetivo.
 * @param {string} model.providerID ID del proveedor OpenCode.
 * @param {string} model.modelID ID del modelo.
 * @param {Array<{ type: string; text: string }>} parts Partes del mensaje a enviar.
 * @param {OpenCodeSdkClient} [client] Cliente OpenCode opcional.
 * @returns {Promise<string>} Texto generado por la petición.
 */
export async function promptOpenCode(
  sessionId: string,
  model: { providerID: string; modelID: string },
  parts: Array<{ type: string; text: string }>,
  client?: OpenCodeSdkClient,
): Promise<string> {
  const c = client ?? getGlobalClient();
  const result = await c.session.prompt({
    path: { id: sessionId },
    body: { model, parts },
  });
  return extractPromptText(result);
}
