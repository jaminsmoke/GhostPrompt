/**
 * @file Lectura de configuración GhostPrompt desde `vscode.workspace` y contexto del editor activo.
 * Extraído de `MiniInputViewProvider` (roadmap v0.3.2 fase A).
 */

import * as vscode from 'vscode';

import {
  DEFAULT_MAX_SUGGESTION_CHARS,
  MAX_MAX_SUGGESTION_CHARS,
  MIN_MAX_SUGGESTION_CHARS,
} from '../../system/internals/protocols/constants/consPipelineDefaults';

import type { SuggestionStyle } from '../../system/internals/protocols/types';

export {
  type AgentDestination,
  getAgentDestination,
  isCursorDesktopHost,
  isVsOpenCodeXExtensionInstalled,
  parseAgentDestination,
} from '../../destinations/destinationRegistry';

/**
 * Obtiene el identificador del modelo seleccionado en la configuración.
 * @returns {string} ID del modelo seleccionado o "auto" si no hay ninguno.
 */
export function getGhostPromptSelectedModelId(): string {
  const value = vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<string>('selectedModelId', 'auto');
  return value.trim() || 'auto';
}

/**
 * Obtiene el límite de caracteres para sugerencias desde la configuración.
 * @returns {number} Número de caracteres máximo permitido para cada sugerencia.
 */
export function getGhostPromptMaxSuggestionChars(): number {
  const rawValue = vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<number>('maxSuggestionChars', DEFAULT_MAX_SUGGESTION_CHARS);
  if (!Number.isFinite(rawValue)) {
    return DEFAULT_MAX_SUGGESTION_CHARS;
  }
  return Math.max(MIN_MAX_SUGGESTION_CHARS, Math.min(MAX_MAX_SUGGESTION_CHARS, Math.floor(rawValue)));
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
 * Recopila contexto de proyecto disponible desde el editor activo (texto tal cual del documento, sin normalizar).
 * @returns {object} Metadata del workspace y selección activa, si aplica.
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
  const selected = editor.selection.isEmpty ? '' : editor.document.getText(editor.selection);
  return {
    workspaceName,
    activeFilePath,
    activeLanguageId,
    ...selected ? { activeSelection: selected } : {},
  };
}
