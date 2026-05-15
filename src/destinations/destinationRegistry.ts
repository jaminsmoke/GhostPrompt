/**
 * @file Registro y lógica común de destinos GhostPrompt.
 */
import * as vscode from 'vscode';

import { CURSOR_CHAT_DESTINATION_ID } from './cursor/cursorHost';

export { CURSOR_CHAT_DESTINATION_ID, isCursorDesktopHost } from './cursor/cursorHost';

export const VS_OPEN_CODE_X_EXTENSION_ID = 'jaminsmoke.vsopencodex';

export const GHOST_PROMPT_AGENT_DESTINATION_IDS = [
  'copilotChat',
  'vsOpenCodeX',
  CURSOR_CHAT_DESTINATION_ID,
] as const;

export type DestinationId = (typeof GHOST_PROMPT_AGENT_DESTINATION_IDS)[number];

export interface DestinationProvider {
  readonly id: DestinationId;
  sendPrompt?(text: string): Promise<void>;
  forwardSuggestionUi?(payload: Record<string, unknown>): void;
}

const registry = new Map<DestinationId, DestinationProvider>();

/**
 * Registra un proveedor de destino para GhostPrompt.
 * @param {DestinationProvider} provider Provider que implementa la interfaz DestinationProvider.
 * @returns {void}
 */
export function registerDestination(provider: DestinationProvider): void {
  registry.set(provider.id, provider);
}

/**
 * Obtiene un proveedor de destino registrado por su ID.
 * @param {DestinationId} id Identificador del destino deseado.
 * @returns {DestinationProvider | undefined} Proveedor de destino o undefined si no está registrado.
 */
export function getDestinationProviderForId(id: DestinationId): DestinationProvider | undefined {
  return registry.get(id);
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

export type GhostPromptAgentDestination = DestinationId;

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
    return (
      inspected.globalValue !== undefined ||
      inspected.workspaceValue !== undefined ||
      inspected.workspaceFolderValue !== undefined
    );
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
 * Normaliza un valor crudo de `ghostPrompt.agentDestination` al enum soportado.
 * Valores desconocidos → `copilotChat`.
 * @param {string | undefined} raw Valor leído de configuración o webview.
 * @returns {GhostPromptAgentDestination} Destino normalizado.
 */
export function parseGhostPromptAgentDestination(
  raw: string | undefined,
): GhostPromptAgentDestination {
  if (raw === 'vsOpenCodeX') {
    return 'vsOpenCodeX';
  }
  if (raw === CURSOR_CHAT_DESTINATION_ID) {
    return CURSOR_CHAT_DESTINATION_ID;
  }
  return 'copilotChat';
}

/**
 * Determina el destino efectivo de GhostPrompt (`copilotChat`, `vsOpenCodeX` o `cursorChat`).
 * Con destino `cursorChat` no aplica gating VSX: suggest/send usan la webview GhostPrompt (como `copilotChat`).
 * @returns {GhostPromptAgentDestination} Destino seleccionado o inferido según configuración y disponibilidad.
 */
export function getGhostPromptAgentDestination(): GhostPromptAgentDestination {
  const cfg = vscode.workspace.getConfiguration('ghostPrompt');
  const v = cfg.get<string>('agentDestination', 'copilotChat');
  if (!isAgentDestinationExplicitlyConfigured() && isVsOpenCodeXExtensionInstalled()) {
    return 'vsOpenCodeX';
  }
  return parseGhostPromptAgentDestination(v);
}

/**
 * Resuelve el ID de destino efectivo a partir de la configuración actual.
 * @returns {DestinationId} ID de destino a usar para enviar prompts.
 */
function resolveEffectiveDestinationId(): DestinationId {
  return getGhostPromptAgentDestination();
}
