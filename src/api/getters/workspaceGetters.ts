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
} from '../../core';

export {
  type GhostPromptAgentDestination,
  getGhostPromptAgentDestination,
  isVsOpenCodeXExtensionInstalled,
} from "../../destinations/destinationRegistry";

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
