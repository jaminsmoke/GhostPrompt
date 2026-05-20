/**
 * @file Registro y lógica común de destinos GhostPrompt.
 */

import * as vscode from 'vscode';

import { hasAnyConfigurationInspectScope } from '../system/internals/isDefined';
import { VS_OPEN_CODE_X_EXTENSION_ID } from '../system/internals/protocols/constants/consDestinations';
import { parseAgentDestination } from '../system/internals/protocols/guards/guardAgentDestination';

import type {
  AgentDestination,
  DestinationId,
  DestinationProvider,
} from '../system/internals/protocols/types/typeDestinations';

export { CURSOR_CHAT_DESTINATION_ID, isCursorDesktopHost } from './cursor/cursorHost';

const registry = new Map<DestinationId, DestinationProvider>();

/**
 * Registra un proveedor de destino para GhostPrompt.
 * @param {DestinationProvider} provider - Provider que implementa la interfaz DestinationProvider.
 * @returns {void}
 */
export function registerDestination(provider: DestinationProvider): void {
  registry.set(provider.id, provider);
}

/**
 * Obtiene un proveedor de destino registrado por su ID.
 * @param {DestinationId} id - Identificador del destino deseado.
 * @returns {DestinationProvider | undefined} Proveedor de destino o undefined si no está registrado.
 */
export function getDestinationProviderForId(id: DestinationId): DestinationProvider | undefined {
  return registry.get(id);
}

/**
 * Comprueba si el destino del agente fue configurado explícitamente por el usuario.
 * @returns {boolean} True si el usuario configuró agentDestination en algún ámbito.
 */
function isAgentDestinationExplicitlyConfigured(): boolean {
  try {
    const cfg = vscode.workspace.getConfiguration('ghostPrompt');
    if (typeof cfg.inspect !== 'function') {
      return true;
    }
    const inspected = cfg.inspect<unknown>('agentDestination');
    if (!inspected) {
      return true;
    }
    return hasAnyConfigurationInspectScope(inspected);
  } catch {
    return true;
  }
}

/**
 * Comprueba si la extensión VSOpenCodeX está instalada en VS Code.
 * @returns {boolean} True si la extensión está disponible.
 */
export function isVsOpenCodeXExtensionInstalled(): boolean {
  try {
    return Boolean(vscode.extensions.getExtension(VS_OPEN_CODE_X_EXTENSION_ID));
  } catch {
    return false;
  }
}

/**
 * Determina el destino efectivo de GhostPrompt (`copilotChat`, `vsOpenCodeX` o `cursorChat`).
 * Con destino `cursorChat` no aplica gating VSX: suggest/send usan la webview GhostPrompt (como `copilotChat`).
 * @returns {AgentDestination} Destino seleccionado o inferido según configuración y disponibilidad.
 */
export function getAgentDestination(): AgentDestination {
  const cfg = vscode.workspace.getConfiguration('ghostPrompt');
  const v = cfg.get<string>('agentDestination', 'copilotChat');
  if (!isAgentDestinationExplicitlyConfigured() && isVsOpenCodeXExtensionInstalled()) {
    return 'vsOpenCodeX';
  }
  return parseAgentDestination(v);
}

/**
 * Resuelve el ID de destino efectivo a partir de la configuración actual.
 * @returns {DestinationId} ID de destino a usar para enviar prompts.
 */
function resolveEffectiveDestinationId(): DestinationId {
  return getAgentDestination();
}

/**
 * Devuelve el proveedor de destino efectivo que debe usarse actualmente.
 * @returns {DestinationProvider} Provider registrado o fallback de error si no se encuentra uno.
 */
export function getActiveDestinationProvider(): DestinationProvider {
  const id = resolveEffectiveDestinationId();
  return (
    registry.get(id) ?? {
      id,
      sendPrompt: () =>
        Promise.reject(new Error(`Destination provider '${id}' no está registrado`)),
    }
  );
}

export {AGENT_DESTINATION_IDS, VS_OPEN_CODE_X_EXTENSION_ID} from '../system/internals/protocols/constants/consDestinations';
export {type DestinationId, type DestinationProvider, type AgentDestination} from '../system/internals/protocols/types/typeDestinations';
export { parseAgentDestination } from '../system/internals/protocols/guards/guardAgentDestination';