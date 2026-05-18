/**
 * @file Lectura de `ghostPrompt.suggestionModelPolicy` desde la API de configuración de VS Code.
 */

import * as vscode from 'vscode';

import type { SuggestionModelPolicy } from '../../protocols/types';

/**
 * Lee la política de modelo de sugerencias desde la configuración del vscode.workspace.
 * @returns {SuggestionModelPolicy} Valor coaccionado a la unión admitida.
 */
export function readGhostPromptSuggestionModelPolicy(): SuggestionModelPolicy {
  const value = vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<string>('suggestionModelPolicy', 'nonPremiumOnly');
  return value === 'anyModel' ? 'anyModel' : 'nonPremiumOnly';
}
