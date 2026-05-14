/**
 * Construye y envía el mensaje `settings` al webview (lista de modelos, chips, etc.).
 */
import * as vscode from 'vscode';
import {
  getCompletionUiKind,
  getEnabledCompletionSources,
  listMergedSuggestionModels,
  listOpencodeSuggestionModels,
  listOllamaSuggestionModels,
  listSuggestionModels,
} from '../../core';
import type {
  SuggestionModelDescriptor,
  SuggestionModelPolicy,
  SuggestionStyle,
  SupportedSuggestionLanguage,
} from '../../core';
import { isSuggestionDebugEnabled } from '../../system/debug/SuggestionDebug';
import { ghostPromptSessionStore } from '../../core/session/GhostPromptSessionStore';
import {
  getGhostPromptAgentDestination,
  isVsOpenCodeXExtensionInstalled,
} from '../getters/workspaceGetters';
import { parseOutboundSettingsEnvelope } from '../protocols/webviewProtocols';

export type GhostPromptSettingsGetters = {
  getSuggestionModelPolicy: () => SuggestionModelPolicy;
  getSelectedModelId: () => string;
  getSuggestionStyle: () => SuggestionStyle;
  getSuggestionLanguageChoice: () => 'auto' | SupportedSuggestionLanguage;
};

/**
 * Normaliza el debounce de sugerencia al rango permitido.
 * @param {number} value Valor de debounce de configuración.
 * @return {number} Valor ajustado dentro del rango mínimo y máximo.
 */
function clampSuggestionDebounceMs(value: number): number {
  return Math.min(2000, Math.max(150, Math.round(value)));
}

/**
 * Construye y envía el payload de configuración al webview.
 * @param {vscode.Webview} webview Webview destinatario del mensaje de settings.
 * @param {GhostPromptSettingsGetters} getters Callbacks para obtener valores runtime de settings.
 * @return {Promise<void>} Promise que se resuelve cuando el mensaje se ha enviado.
 */
export async function buildAndPostGhostPromptSettings(
  webview: vscode.Webview,
  getters: GhostPromptSettingsGetters,
): Promise<void> {
  const gpCfg = vscode.workspace.getConfiguration('ghostPrompt');
  const suggestionDebounceMs = clampSuggestionDebounceMs(
    gpCfg.get<number>('suggestionDebounceMs', 800),
  );
  const policy = getters.getSuggestionModelPolicy();
  const enabledSources = getEnabledCompletionSources();
  const completionUiKind = getCompletionUiKind();
  const completionProvider = completionUiKind === 'multi' ? 'copilot' : completionUiKind;
  let availableModels: SuggestionModelDescriptor[] = [];
  try {
    if (enabledSources.length > 1) {
      availableModels = await listMergedSuggestionModels(policy, enabledSources);
    } else if (enabledSources[0] === 'opencode') {
      availableModels = await listOpencodeSuggestionModels(policy);
    } else if (enabledSources[0] === 'ollama') {
      availableModels = await listOllamaSuggestionModels(policy);
    } else {
      availableModels = await listSuggestionModels(policy);
    }
  } catch {
    availableModels = [];
  }
  const envelope = {
    type: 'settings' as const,
    settings: {
      completionProvider,
      completionUiKind,
      enabledCompletionSources: enabledSources,
      suggestionModelPolicy: policy,
      selectedModelId: getters.getSelectedModelId(),
      availableModels,
      suggestionStyle: getters.getSuggestionStyle(),
      suggestionLanguageChoice: getters.getSuggestionLanguageChoice(),
      effectiveSuggestionLanguage:
        ghostPromptSessionStore.getSnapshot().lastEffectiveSuggestionLanguage,
      effectiveModel: ghostPromptSessionStore.getSnapshot().lastEffectiveModel,
      debugSuggestions: isSuggestionDebugEnabled(),
      suggestionDebounceMs,
      agentDestination: getGhostPromptAgentDestination(),
      vsOpenCodeXExtensionInstalled: isVsOpenCodeXExtensionInstalled(),
    },
  };
  const validated = parseOutboundSettingsEnvelope(envelope);
  if (!validated) {
    return;
  }
  webview.postMessage(validated);
}
