/**
 * @file Lectura de configuración GhostPrompt desde `vscode.workspace` y contexto del editor activo.
 */

import * as vscode from 'vscode';

import {
  DEFAULT_MAX_SUGGESTION_CHARS,
  DEFAULT_MIN_CHARS_FOR_SUGGESTION,
  DEFAULT_SUGGESTION_DEBOUNCE_MS,
  MAX_MIN_CHARS_FOR_SUGGESTION,
  MAX_SUGGESTION_DEBOUNCE_MS,
  MIN_MIN_CHARS_FOR_SUGGESTION,
  MIN_SUGGESTION_DEBOUNCE_MS,
} from '../../protocols/constants/consPipelineDefaults';
import { clampMaxSuggestionChars } from '../../protocols/suggestionLength/suggestionLength';

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
  return clampMaxSuggestionChars(rawValue);
}

/**
 * Obtiene el mínimo de caracteres (tras trim) para solicitar una suggestion.
 * @returns {number} Umbral alineado a `ghostPrompt.minCharsForSuggestion`.
 */
export function getGhostPromptMinCharsForSuggestion(): number {
  const rawValue = vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<number>('minCharsForSuggestion', DEFAULT_MIN_CHARS_FOR_SUGGESTION);
  if (!Number.isFinite(rawValue)) {
    return DEFAULT_MIN_CHARS_FOR_SUGGESTION;
  }
  return Math.max(
    MIN_MIN_CHARS_FOR_SUGGESTION,
    Math.min(MAX_MIN_CHARS_FOR_SUGGESTION, Math.floor(rawValue)),
  );
}

/**
 * Obtiene el debounce del webview antes de pedir suggestion (ms).
 * @returns {number} Valor dentro del rango permitido por producto.
 */
export function getGhostPromptSuggestionDebounceMs(): number {
  const rawValue = vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<number>('suggestionDebounceMs', DEFAULT_SUGGESTION_DEBOUNCE_MS);
  if (!Number.isFinite(rawValue)) {
    return DEFAULT_SUGGESTION_DEBOUNCE_MS;
  }
  return Math.max(
    MIN_SUGGESTION_DEBOUNCE_MS,
    Math.min(MAX_SUGGESTION_DEBOUNCE_MS, Math.round(rawValue)),
  );
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
