/**
 * @file Construye y envía el mensaje `settings` al webview (lista de modelos, chips, etc.).
 */
import {
  getAgentDestination,
  isCursorDesktopHost,
  isVsOpenCodeXExtensionInstalled,
} from '../../destinations/destinationRegistry';
import { getCompletionUiKind, getEnabledCompletionSources } from '../../engines/config/completionSources';
import { listSuggestionModels } from '../../engines/provider/copilot/catalog/modelCatalog';
import { listMergedSuggestionModels } from '../../engines/provider/mergedModelCatalog';
import { listOllamaSuggestionModels } from '../../engines/provider/ollama/catalog/ollamaModelCatalog';
import { listOpencodeSuggestionModels } from '../../engines/provider/opencode/catalog/opencodeModelCatalog';
import { getGhostPromptSuggestionDebounceMs } from '../../system/internals/config/read/workspaceConfigGetters';
import { isSuggestionDebugEnabled } from '../../system/log';
import { getLastEffectiveSuggestionModel } from '../../system/runtime/suggest/lastEffectiveSuggestionModel';
import { parseOutboundSettingsEnvelope } from '../boundary/webviewProtocols';

import type { SuggestionModelDescriptor, SuggestionModelPolicy } from '../../system/internals/protocols/types';
import type * as vscode from 'vscode';

export type GhostPromptSettingsGetters = {
  getSuggestionModelPolicy: () => SuggestionModelPolicy;
  getSelectedModelId: () => string;
  getMaxSuggestionChars: () => number;
};

/**
 * Construye y envía el payload de configuración al webview.
 * @param {vscode.Webview} webview - Webview destinatario del mensaje de settings.
 * @param {GhostPromptSettingsGetters} getters - Callbacks para obtener valores runtime de settings.
 * @returns {Promise<void>} Promise que se resuelve cuando el mensaje se ha enviado.
 */
export async function buildAndPostGhostPromptSettings(
  webview: vscode.Webview,
  getters: GhostPromptSettingsGetters,
): Promise<void> {
  const suggestionDebounceMs = getGhostPromptSuggestionDebounceMs();
  const policy = getters.getSuggestionModelPolicy();
  const enabledSources = getEnabledCompletionSources();
  const completionUiKind = getCompletionUiKind();
  const completionProvider = completionUiKind === 'multi' ? 'copilot' : completionUiKind;
  const availableModels = await (async (): Promise<SuggestionModelDescriptor[]> => {
    if (enabledSources.length > 1) {
      return listMergedSuggestionModels(policy, enabledSources);
    }
    if (enabledSources[0] === 'opencode') {
      return listOpencodeSuggestionModels(policy);
    }
    if (enabledSources[0] === 'ollama') {
      return listOllamaSuggestionModels(policy);
    }
    return listSuggestionModels(policy);
  })().catch(() => []);
  const envelope = {
    type: 'settings' as const,
    settings: {
      completionProvider,
      completionUiKind,
      enabledCompletionSources: enabledSources,
      suggestionModelPolicy: policy,
      selectedModelId: getters.getSelectedModelId(),
      availableModels,
      maxSuggestionChars: getters.getMaxSuggestionChars(),
      effectiveModel: getLastEffectiveSuggestionModel(),
      debugSuggestions: isSuggestionDebugEnabled(),
      suggestionDebounceMs,
      agentDestination: getAgentDestination(),
      vsOpenCodeXExtensionInstalled: isVsOpenCodeXExtensionInstalled(),
      cursorDesktopHost: isCursorDesktopHost(),
    },
  };
  const validated = parseOutboundSettingsEnvelope(envelope);
  if (!validated) {
    return;
  }
  webview.postMessage(validated);
}
