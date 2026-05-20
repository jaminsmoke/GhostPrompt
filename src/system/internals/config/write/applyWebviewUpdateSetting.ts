/**
 * @file Aplica cambios de configuración originados en el webview (`updateSetting`).
 */

import * as vscode from 'vscode';

import { parseAgentDestination } from '../../../../destinations/destinationRegistry';
import { clampMaxSuggestionChars } from '../../protocols/suggestionLength/suggestionLength';

import type { WebviewInboundMessage } from '../../protocols/validations/schemas/zschemWebviewMessages';

/**
 * Aplica una actualización de configuración enviada desde el webview.
 * @param {object} message - Mensaje `updateSetting` recibido del webview.
 * @returns {Promise<void>} Promise que se resuelve una vez aplicados los cambios.
 */
export async function applyWebviewUpdateSetting(
  message: Extract<WebviewInboundMessage, { type: 'updateSetting' }>,
): Promise<void> {
  const config = vscode.workspace.getConfiguration('ghostPrompt');
  if (message.key === 'completionProvider') {
    let value: 'copilot' | 'opencode' | 'ollama' = 'copilot';
    if (message.value === 'opencode') {
      value = 'opencode';
    } else if (message.value === 'ollama') {
      value = 'ollama';
    }
    await config.update('enabledCompletionSources', [value], vscode.ConfigurationTarget.Global);
    await config.update('completionProvider', value, vscode.ConfigurationTarget.Global);
    return;
  }
  if (message.key === 'suggestionModelPolicy') {
    const value = message.value === 'anyModel' ? 'anyModel' : 'nonPremiumOnly';
    await config.update('suggestionModelPolicy', value, vscode.ConfigurationTarget.Global);
    return;
  }
  if (message.key === 'selectedModelId') {
    const value = typeof message.value === 'string' ? message.value : 'auto';
    await config.update('selectedModelId', value, vscode.ConfigurationTarget.Global);
    return;
  }
  if (message.key === 'maxSuggestionChars') {
    await config.update(
      'maxSuggestionChars',
      clampMaxSuggestionChars(message.value),
      vscode.ConfigurationTarget.Global,
    );
    return;
  }
  if (message.key === 'debugSuggestions') {
    await config.update('debugSuggestions', message.value, vscode.ConfigurationTarget.Global);
    return;
  }
  const value = parseAgentDestination(typeof message.value === 'string' ? message.value : '');
  await config.update('agentDestination', value, vscode.ConfigurationTarget.Global);
}
