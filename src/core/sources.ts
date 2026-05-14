/**
 * Fuentes de completion habilitadas (`copilot` LM vs OpenCode).
 * Si `enabledCompletionSources` no está definido en ningún scope, se usa el legacy `completionProvider`.
 */
import * as vscode from "vscode";

export type CompletionSourceId = "copilot" | "opencode" | "ollama";

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
  if (v === "opencode") {
    return ["opencode"];
  }
  if (v === "ollama") {
    return ["ollama"];
  }
  return ["copilot"];
}

function normalizeCompletionSources(raw: unknown): CompletionSourceId[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: CompletionSourceId[] = [];
  const seen = new Set<CompletionSourceId>();
  for (const item of raw) {
    if (item === "copilot" || item === "opencode" || item === "ollama") {
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
export function looksLikeOllamaModelId(id: string): boolean {
  return id.includes(":") && !id.includes("/");
}

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
    if (enabledSources.includes("opencode")) {
      return "opencode";
    }
    return "ollama";
  }
  if (
    enabledSources.includes("ollama") &&
    looksLikeOllamaModelId(selectedModelId)
  ) {
    return "ollama";
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
  if (enabledSources.includes("opencode")) {
    return "opencode";
  }
  return "ollama";
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

export function getCompletionUiKind(): "copilot" | "opencode" | "ollama" | "multi" {
  const s = getEnabledCompletionSources();
  if (s.length > 1) {
    return "multi";
  }
  return s[0];
}
