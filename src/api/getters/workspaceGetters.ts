/**
 * Lectura de configuración GhostPrompt desde `vscode.workspace` y contexto del editor activo.
 * Extraído de `MiniInputViewProvider` (roadmap v0.3.2 fase A).
 */
import * as vscode from 'vscode';
import type {
  SuggestionLanguageMode,
  SuggestionModelPolicy,
  SuggestionStyle,
  SupportedSuggestionLanguage,
} from '../../core/types';

export {
  type GhostPromptAgentDestination,
  getGhostPromptAgentDestination,
  isCursorDesktopHost,
  isVsOpenCodeXExtensionInstalled,
  parseGhostPromptAgentDestination,
} from '../../destinations/destinationRegistry';

/**
 * Normaliza y recorta un campo de contexto para el prompt.
 * @param {string} value Cadena original a normalizar.
 * @param {number} maxChars Límite máximo de caracteres en el campo.
 * @returns {string} Texto limpio y recortado con elípsis si excede el límite.
 */
function trimContextField(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 3))}...`;
}

/**
 * Lee la política de modelo de sugerencias desde la configuración de GhostPrompt.
 * @returns {SuggestionModelPolicy} Política válida de sugerencia de modelo.
 */
export function getGhostPromptSuggestionModelPolicy(): SuggestionModelPolicy {
  const value = vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<string>('suggestionModelPolicy', 'nonPremiumOnly');
  return value === 'anyModel' ? 'anyModel' : 'nonPremiumOnly';
}

/**
 * Obtiene el identificador del modelo seleccionado en la configuración.
 * @returns {string} ID del modelo seleccionado o "auto" si no hay ninguno.
 */
export function getGhostPromptSelectedModelId(): string {
  const value = vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<string>('selectedModelId', 'auto');
  return value?.trim() || 'auto';
}

/**
 * Obtiene el límite de caracteres para sugerencias desde la configuración.
 * @returns {number} Número de caracteres máximo permitido para cada sugerencia.
 */
export function getGhostPromptMaxSuggestionChars(): number {
  const rawValue = vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<number>('maxSuggestionChars', 180);
  if (!Number.isFinite(rawValue)) {
    return 180;
  }
  return Math.max(40, Math.min(500, Math.floor(rawValue)));
}

/**
 * Obtiene el estilo de sugerencia seleccionado en la configuración.
 * @returns {SuggestionStyle} Estilo de sugerencia válido.
 */
export function getGhostPromptSuggestionStyle(): SuggestionStyle {
  const value = vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<string>('suggestionStyle', 'balanced');
  if (value === 'concise' || value === 'detailed') {
    return value;
  }
  return 'balanced';
}

/**
 * Comprueba si el project memory está habilitado en la configuración.
 * @returns {boolean} True si project memory está activo.
 */
export function getGhostPromptProjectMemoryEnabled(): boolean {
  return vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<boolean>('projectMemoryEnabled', true);
}

/**
 * Obtiene el modo de idioma para sugerencias desde la configuración.
 * @returns {SuggestionLanguageMode} Modo de idioma válido: auto o manual.
 */
export function getGhostPromptSuggestionLanguageMode(): SuggestionLanguageMode {
  const value = vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<string>('suggestionLanguageMode', 'auto');
  return value === 'manual' ? 'manual' : 'auto';
}

/**
 * Obtiene el idioma de sugerencia seleccionado en la configuración.
 * @returns {SupportedSuggestionLanguage} Idioma válido: es o en.
 */
export function getGhostPromptSuggestionLanguage(): SupportedSuggestionLanguage {
  const value = vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<string>('suggestionLanguage', 'en');
  return value === 'es' ? 'es' : 'en';
}

/**
 * Obtiene la elección de idioma de sugerencia mostrada en la UI.
 * @returns {{| "auto" | SupportedSuggestionLanguage |}} "auto" o el idioma manual seleccionado.
 */
export function getGhostPromptSuggestionLanguageChoice(): 'auto' | SupportedSuggestionLanguage {
  const mode = getGhostPromptSuggestionLanguageMode();
  if (mode === 'auto') {
    return 'auto';
  }
  return getGhostPromptSuggestionLanguage();
}

/**
 * Obtiene la URL base de Ollama desde la configuración.
 * @returns {string} Cadena con la URL de Ollama.
 */
export function getGhostPromptOllamaBaseUrl(): string {
  return vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<string>('ollamaBaseUrl', 'http://localhost:11434');
}

/**
 * Obtiene la lista de modelos excluidos para Ollama desde la configuración.
 * @returns {string[]} Array de IDs de modelo que deben ignorarse.
 */
export function getGhostPromptOllamaExcludedModelIds(): string[] {
  return vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<string[]>('ollamaExcludedModelIds', []);
}

/**
 * Recopila contexto de proyecto disponible desde el editor activo.
 * @returns {{ workspaceName?: string; activeFilePath?: string; activeLanguageId?: string; activeSelection?: string }} Metadata del workspace y selección activa, si aplica.
 */
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
  const selected = editor.selection?.isEmpty ? '' : editor.document.getText(editor.selection);
  const activeSelection = selected ? trimContextField(selected, 320) : undefined;
  return {
    workspaceName,
    activeFilePath: trimContextField(activeFilePath, 180),
    activeLanguageId: trimContextField(activeLanguageId, 40),
    activeSelection,
  };
}
