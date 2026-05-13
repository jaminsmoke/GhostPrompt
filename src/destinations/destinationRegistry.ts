import * as vscode from "vscode";

export const VS_OPEN_CODE_X_EXTENSION_ID = "jaminsmoke.vsopencodex";

export type DestinationId = "copilotChat" | "vsOpenCodeX";

export interface DestinationProvider {
  readonly id: DestinationId;
  sendPrompt?(text: string): Promise<void>;
  forwardSuggestionUi?(payload: Record<string, unknown>): void;
}

const registry = new Map<DestinationId, DestinationProvider>();

export function registerDestination(provider: DestinationProvider): void {
  registry.set(provider.id, provider);
}

export function getDestinationProviderForId(
  id: DestinationId,
): DestinationProvider | undefined {
  return registry.get(id);
}

export function getActiveDestinationProvider(): DestinationProvider {
  const id = resolveEffectiveDestinationId();
  return registry.get(id) ?? { id, sendPrompt: async () => {} };
}

export type GhostPromptAgentDestination = DestinationId;

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

export function isVsOpenCodeXExtensionInstalled(): boolean {
  try {
    return Boolean(vscode.extensions?.getExtension?.(VS_OPEN_CODE_X_EXTENSION_ID));
  } catch {
    return false;
  }
}

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

function resolveEffectiveDestinationId(): DestinationId {
  return getGhostPromptAgentDestination();
}
