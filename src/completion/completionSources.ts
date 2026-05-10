/**
 * Fuentes de completion habilitadas (`copilot` LM vs OpenCode).
 * Si `enabledCompletionSources` no está definido en ningún scope, se usa el legacy `completionProvider`.
 */
import * as vscode from "vscode";

export type CompletionSourceId = "copilot" | "opencode";

export function getEnabledCompletionSources(): CompletionSourceId[] {
  const cfg = vscode.workspace.getConfiguration("ghostPrompt");
  const inspected = cfg.inspect<CompletionSourceId[]>("enabledCompletionSources");

  const explicit =
    inspected?.globalValue !== undefined ||
    inspected?.workspaceValue !== undefined ||
    inspected?.workspaceFolderValue !== undefined;

  if (!explicit) {
    return legacySourcesFromCompletionProvider();
  }

  const normalized = normalizeCompletionSources(cfg.get("enabledCompletionSources"));
  if (normalized.length === 0) {
    return legacySourcesFromCompletionProvider();
  }
  return normalized;
}

function legacySourcesFromCompletionProvider(): CompletionSourceId[] {
  const v = vscode.workspace
    .getConfiguration("ghostPrompt")
    .get<string>("completionProvider", "copilot");
  return v === "opencode" ? ["opencode"] : ["copilot"];
}

function normalizeCompletionSources(raw: unknown): CompletionSourceId[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: CompletionSourceId[] = [];
  const seen = new Set<CompletionSourceId>();
  for (const item of raw) {
    if (item === "copilot" || item === "opencode") {
      if (!seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
  }
  return out;
}

/**
 * Elige motor para esta petición según modelo seleccionado y fuentes habilitadas.
 * Con `auto` y varias fuentes, se prefiere Copilot si está habilitado (orden estable).
 */
export function resolveCompletionSourceForRequest(
  selectedModelId: string,
  enabledSources: readonly CompletionSourceId[],
): CompletionSourceId {
  if (enabledSources.length === 1) {
    return enabledSources[0];
  }
  if (selectedModelId === "auto") {
    if (enabledSources.includes("copilot")) {
      return "copilot";
    }
    return "opencode";
  }
  if (
    enabledSources.includes("opencode") &&
    looksLikeOpencodeModelId(selectedModelId)
  ) {
    return "opencode";
  }
  if (enabledSources.includes("copilot")) {
    return "copilot";
  }
  return "opencode";
}

/** Id OpenCode típico: `providerID/modelID` (una barra). */
export function looksLikeOpencodeModelId(id: string): boolean {
  const t = id.trim();
  const slash = t.indexOf("/");
  if (slash <= 0 || slash === t.length - 1) {
    return false;
  }
  return !t.includes("//") && t.split("/").length === 2;
}

export function getCompletionUiKind(): "copilot" | "opencode" | "multi" {
  const s = getEnabledCompletionSources();
  if (s.length > 1) {
    return "multi";
  }
  return s[0];
}
