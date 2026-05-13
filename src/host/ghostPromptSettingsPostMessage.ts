/**
 * Construye y envía el mensaje `settings` al webview (lista de modelos, chips, etc.).
 */
import * as vscode from "vscode";
import {
  getCompletionUiKind,
  getEnabledCompletionSources,
  listMergedSuggestionModels,
  listOpencodeSuggestionModels,
  listOllamaSuggestionModels,
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
import {
  getGhostPromptAgentDestination,
  isVsOpenCodeXExtensionInstalled,
} from "./ghostPromptHostWorkspaceGetters";
import { parseOutboundSettingsEnvelope } from "./webviewProtocols";

export type GhostPromptSettingsGetters = {
  getSuggestionModelPolicy: () => SuggestionModelPolicy;
  getSelectedModelId: () => string;
  getSuggestionStyle: () => SuggestionStyle;
  getContextMode: () => "off" | "basic" | "project";
  getSuggestionLanguageChoice: () => "auto" | SupportedSuggestionLanguage;
};

function clampSuggestionDebounceMs(value: number): number {
  return Math.min(2000, Math.max(150, Math.round(value)));
}

export async function buildAndPostGhostPromptSettings(
  webview: vscode.Webview,
  getters: GhostPromptSettingsGetters,
): Promise<void> {
  const gpCfg = vscode.workspace.getConfiguration("ghostPrompt");
  const suggestionDebounceMs = clampSuggestionDebounceMs(
    gpCfg.get<number>("suggestionDebounceMs", 800),
  );
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
    } else if (enabledSources[0] === "ollama") {
      availableModels = await listOllamaSuggestionModels(policy);
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
