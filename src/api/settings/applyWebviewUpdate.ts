/**
 * Aplica cambios de configuración originados en el webview (`updateSetting`).
 */
import * as vscode from 'vscode';
import { ghostPromptSessionStore } from '../../core/state/GhostPromptSessionStore';
import { parseGhostPromptAgentDestination } from '../../destinations/destinationRegistry';
import type { WebviewInboundMessage } from '../protocols/webviewProtocols';

/**
 * Aplica una actualización de configuración enviada desde el webview.
 * @param {Extract<WebviewInboundMessage, { type: "updateSetting" }>} message Mensaje de configuración recibido del webview.
 * @returns {Promise<void>} Promise que se resuelve una vez aplicados los cambios.
 */
export async function applyWebviewUpdateSetting(
  message: Extract<WebviewInboundMessage, { type: 'updateSetting' }>,
): Promise<void> {
  const config = vscode.workspace.getConfiguration('ghostPrompt');
  if (message.key === 'completionProvider') {
    const value =
      message.value === 'opencode' ? 'opencode' : message.value === 'ollama' ? 'ollama' : 'copilot';
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
  if (message.key === 'suggestionStyle') {
    const value =
      message.value === 'concise' || message.value === 'detailed' ? message.value : 'balanced';
    await config.update('suggestionStyle', value, vscode.ConfigurationTarget.Global);
    return;
  }
  if (message.key === 'suggestionLanguageChoice') {
    const choice =
      message.value === 'auto' || message.value === 'es' || message.value === 'en'
        ? message.value
        : 'auto';
    if (choice === 'auto') {
      await config.update('suggestionLanguageMode', 'auto', vscode.ConfigurationTarget.Global);
    } else {
      await config.update('suggestionLanguageMode', 'manual', vscode.ConfigurationTarget.Global);
      await config.update('suggestionLanguage', choice, vscode.ConfigurationTarget.Global);
      ghostPromptSessionStore.patchState({
        lastEffectiveSuggestionLanguage: choice,
      });
    }
    return;
  }
  if (message.key === 'debugSuggestions') {
    await config.update(
      'debugSuggestions',
      Boolean(message.value),
      vscode.ConfigurationTarget.Global,
    );
    return;
  }
  if (message.key === 'agentDestination') {
    const value = parseGhostPromptAgentDestination(
      typeof message.value === 'string' ? message.value : undefined,
    );
    await config.update('agentDestination', value, vscode.ConfigurationTarget.Global);
  }
}
