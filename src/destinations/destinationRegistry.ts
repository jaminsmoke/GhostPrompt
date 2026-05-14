import * as vscode from "vscode";

export const VS_OPEN_CODE_X_EXTENSION_ID = "jaminsmoke.vsopencodex";

export type DestinationId = "copilotChat" | "vsOpenCodeX";

export interface DestinationProvider {
  readonly id: DestinationId;
  sendPrompt?(text: string): Promise<void>;
  forwardSuggestionUi?(payload: Record<string, unknown>): void;
}

const registry = new Map<DestinationId, DestinationProvider>();

/**
 * Registra un proveedor de destino para GhostPrompt.
 * @param provider Provider que implementa la interfaz DestinationProvider.
 * @returns Void.
 */
export function registerDestination(provider: DestinationProvider): void {
  registry.set(provider.id, provider);
}

/**
 * Obtiene un proveedor de destino registrado por su ID.
 * @param id Identificador del destino deseado.
 * @returns Proveedor de destino o undefined si no está registrado.
 */
export function getDestinationProviderForId(
  id: DestinationId,
): DestinationProvider | undefined {
  return registry.get(id);
}

/**
 * Devuelve el proveedor de destino efectivo que debe usarse actualmente.
 * @returns Provider registrado o fallback de error si no se encuentra uno.
 */
export function getActiveDestinationProvider(): DestinationProvider {
  const id = resolveEffectiveDestinationId();
  return (
    registry.get(id) ?? {
      id,
      sendPrompt: async () => {
        throw new Error(`Destination provider '${id}' no está registrado`);
      },
    }
  );
}

export type GhostPromptAgentDestination = DestinationId;

/**
 * Comprueba si el destino del agente fue configurado explícitamente por el usuario.
 * @returns True si el usuario configuró agentDestination en algún ámbito.
 */
function isAgentDestinationExplicitlyConfigured(): boolean {
  try {
    const cfg = vscode.workspace.getConfiguration("ghostPrompt");
    if (typeof cfg.inspect !== "function") {
      return true;
    }
    const inspected = cfg.inspect<unknown>("agentDestination");
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
 * @returns True si la extensión está disponible.
 */
export function isVsOpenCodeXExtensionInstalled(): boolean {
  try {
    return Boolean(vscode.extensions?.getExtension?.(VS_OPEN_CODE_X_EXTENSION_ID));
  } catch {
    return false;
  }
}

/**
 * Determina el destino efectivo de GhostPrompt (copilotChat o vsOpenCodeX).
 * @returns Destino seleccionado o inferido según configuración y disponibilidad.
 */
export function getGhostPromptAgentDestination(): GhostPromptAgentDestination {
  const cfg = vscode.workspace.getConfiguration("ghostPrompt");
  const v = cfg.get<string>("agentDestination", "copilotChat");
  if (
    !isAgentDestinationExplicitlyConfigured() &&
    isVsOpenCodeXExtensionInstalled()
  ) {
    return "vsOpenCodeX";
  }
  return v === "vsOpenCodeX" ? "vsOpenCodeX" : "copilotChat";
}

/**
 * Resuelve el ID de destino efectivo a partir de la configuración actual.
 * @returns ID de destino a usar para enviar prompts.
 */
function resolveEffectiveDestinationId(): DestinationId {
  return getGhostPromptAgentDestination();
}
