/**
 * Lectura de configuración GhostPrompt desde `vscode.workspace` y contexto del editor activo.
 * Extraído de `MiniInputViewProvider` (roadmap v0.3.2 fase A).
 */
import * as vscode from "vscode";
import type {
  SuggestionLanguageMode,
  SuggestionModelPolicy,
  SuggestionStyle,
  SupportedSuggestionLanguage,
} from "../completion";
import { VS_OPEN_CODE_X_EXTENSION_ID } from "../opencode/vsOpenCodeXBridge";

/** Destino del agente que ejecuta el prompt final (v0.5 Fase C). */
export type GhostPromptAgentDestination = "copilotChat" | "vsOpenCodeX";

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

/** VSOpenCodeX instalada (no implica que el servidor OpenCode esté listo). */
export function isVsOpenCodeXExtensionInstalled(): boolean {
  try {
    return Boolean(vscode.extensions?.getExtension?.(VS_OPEN_CODE_X_EXTENSION_ID));
  } catch {
    return false;
  }
}

/**
 * Destino efectivo: si VSX está instalada y el usuario nunca guardó `agentDestination`,
 * se asume **vsOpenCodeX** (alineado con integración por defecto).
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

function trimContextField(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 3))}...`;
}

export function getGhostPromptSuggestionModelPolicy(): SuggestionModelPolicy {
  const value = vscode.workspace
    .getConfiguration("ghostPrompt")
    .get<string>("suggestionModelPolicy", "nonPremiumOnly");
  return value === "anyModel" ? "anyModel" : "nonPremiumOnly";
}

export function getGhostPromptSelectedModelId(): string {
  const value = vscode.workspace
    .getConfiguration("ghostPrompt")
    .get<string>("selectedModelId", "auto");
  return value?.trim() || "auto";
}

export function getGhostPromptMaxSuggestionChars(): number {
  const rawValue = vscode.workspace
    .getConfiguration("ghostPrompt")
    .get<number>("maxSuggestionChars", 180);
  if (!Number.isFinite(rawValue)) {
    return 180;
  }
  return Math.max(40, Math.min(500, Math.floor(rawValue)));
}

export function getGhostPromptSuggestionStyle(): SuggestionStyle {
  const value = vscode.workspace
    .getConfiguration("ghostPrompt")
    .get<string>("suggestionStyle", "balanced");
  if (value === "concise" || value === "detailed") {
    return value;
  }
  return "balanced";
}

export function getGhostPromptContextMode(): "off" | "basic" | "project" {
  const value = vscode.workspace
    .getConfiguration("ghostPrompt")
    .get<string>("contextMode", "basic");
  if (value === "off" || value === "project") {
    return value;
  }
  return "basic";
}

export function getGhostPromptProjectMemoryEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("ghostPrompt")
    .get<boolean>("projectMemoryEnabled", true);
}

export function getGhostPromptSuggestionLanguageMode(): SuggestionLanguageMode {
  const value = vscode.workspace
    .getConfiguration("ghostPrompt")
    .get<string>("suggestionLanguageMode", "auto");
  return value === "manual" ? "manual" : "auto";
}

export function getGhostPromptSuggestionLanguage(): SupportedSuggestionLanguage {
  const value = vscode.workspace
    .getConfiguration("ghostPrompt")
    .get<string>("suggestionLanguage", "en");
  return value === "es" ? "es" : "en";
}

export function getGhostPromptSuggestionLanguageChoice():
  | "auto"
  | SupportedSuggestionLanguage {
  const mode = getGhostPromptSuggestionLanguageMode();
  if (mode === "auto") {
    return "auto";
  }
  return getGhostPromptSuggestionLanguage();
}

export function getGhostPromptOllamaBaseUrl(): string {
  return vscode.workspace
    .getConfiguration("ghostPrompt")
    .get<string>("ollamaBaseUrl", "http://localhost:11434");
}

export function getGhostPromptOllamaExcludedModelIds(): string[] {
  return vscode.workspace
    .getConfiguration("ghostPrompt")
    .get<string[]>("ollamaExcludedModelIds", []);
}

export function collectGhostPromptProjectContext(): {
  workspaceName?: string;
  activeFilePath?: string;
  activeLanguageId?: string;
  activeSelection?: string;
} {
  const editor = vscode.window.activeTextEditor;
  const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name;
  if (!editor) {
    return { workspaceName };
  }
  const activeLanguageId = editor.document.languageId;
  const activeFilePath = vscode.workspace.asRelativePath(editor.document.uri, false);
  const selected = editor.selection?.isEmpty
    ? ""
    : editor.document.getText(editor.selection);
  const activeSelection = selected ? trimContextField(selected, 320) : undefined;
  return {
    workspaceName,
    activeFilePath: trimContextField(activeFilePath, 180),
    activeLanguageId: trimContextField(activeLanguageId, 40),
    activeSelection,
  };
}
