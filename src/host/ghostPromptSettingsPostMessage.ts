/**
 * Construye y envía el mensaje `settings` al webview (lista de modelos, chips, etc.).
 */
import * as vscode from "vscode";
import {
  getCompletionUiKind,
  getEnabledCompletionSources,
  listMergedSuggestionModels,
  listOpencodeSuggestionModels,
  listSuggestionModels,
} from "../completion";
import type {
  SuggestionModelDescriptor,
  SuggestionModelPolicy,
  SuggestionStyle,
  SupportedSuggestionLanguage,
} from "../completion";
import { isSuggestionDebugEnabled } from "../debug/SuggestionDebug";
import { ghostPromptSessionStore } from "../session/GhostPromptSessionStore";
import { parseOutboundSettingsEnvelope } from "./webviewProtocols";

export type GhostPromptSettingsGetters = {
  getSuggestionModelPolicy: () => SuggestionModelPolicy;
  getSelectedModelId: () => string;
  getSuggestionStyle: () => SuggestionStyle;
  getContextMode: () => "off" | "basic" | "project";
  getSuggestionLanguageChoice: () => "auto" | SupportedSuggestionLanguage;
};

export async function buildAndPostGhostPromptSettings(
  webview: vscode.Webview,
  getters: GhostPromptSettingsGetters,
): Promise<void> {
  const policy = getters.getSuggestionModelPolicy();
  const enabledSources = getEnabledCompletionSources();
  const completionUiKind = getCompletionUiKind();
  const completionProvider =
    completionUiKind === "multi" ? "copilot" : completionUiKind;
  let availableModels: SuggestionModelDescriptor[] = [];
  try {
    if (enabledSources.length > 1) {
      availableModels = await listMergedSuggestionModels(policy, enabledSources);
    } else if (enabledSources[0] === "opencode") {
      availableModels = await listOpencodeSuggestionModels(policy);
    } else {
      availableModels = await listSuggestionModels(policy);
    }
  } catch {
    availableModels = [];
  }
  const envelope = {
    type: "settings" as const,
    settings: {
      completionProvider,
      completionUiKind,
      enabledCompletionSources: enabledSources,
      suggestionModelPolicy: policy,
      selectedModelId: getters.getSelectedModelId(),
      availableModels,
      suggestionStyle: getters.getSuggestionStyle(),
      contextMode: getters.getContextMode(),
      suggestionLanguageChoice: getters.getSuggestionLanguageChoice(),
      effectiveSuggestionLanguage:
        ghostPromptSessionStore.getSnapshot().lastEffectiveSuggestionLanguage,
      effectiveModel: ghostPromptSessionStore.getSnapshot().lastEffectiveModel,
      debugSuggestions: isSuggestionDebugEnabled(),
    },
  };
  const validated = parseOutboundSettingsEnvelope(envelope);
  if (!validated) {
    return;
  }
  webview.postMessage(validated);
}
