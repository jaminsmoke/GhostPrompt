export type GhostPromptCapabilities = {
  compactToolbar?: boolean;
};

declare global {
  interface Window {
    __ghostPromptViewId?: string;
    __ghostPromptCapabilities?: GhostPromptCapabilities;
  }
}

export type AgentDestination = "copilotChat" | "vsOpenCodeX";

export type CompletionProvider = "copilot" | "opencode" | "ollama";

export type SuggestionModel = {
  id: string;
  label: string;
  tier: "included" | "premium" | "unknown";
  pricing?: string;
  provider?: string;
  completionSource?: CompletionProvider;
};

export type SettingsPayload = {
  completionProvider: CompletionProvider;
  completionUiKind: "copilot" | "opencode" | "ollama" | "multi";
  enabledCompletionSources: CompletionProvider[];
  suggestionModelPolicy: "nonPremiumOnly" | "anyModel";
  selectedModelId: string;
  availableModels: SuggestionModel[];
  suggestionStyle: "concise" | "balanced" | "detailed";
  contextMode: "off" | "basic" | "project";
  suggestionLanguageChoice: "auto" | "es" | "en";
  effectiveSuggestionLanguage: "es" | "en";
  effectiveModel?: SuggestionModel;
  debugSuggestions: boolean;
  suggestionDebounceMs: number;
  agentDestination: AgentDestination;
  vsOpenCodeXExtensionInstalled: boolean;
};

export type InboundMessage =
  | {
      type: "loading";
      captureId: number;
      broadcast?: boolean;
      phase?: string;
      statusText?: string;
    }
  | {
      type: "suggestion-stream";
      text: string;
      captureId: number;
      broadcast?: boolean;
    }
  | {
      type: "suggestion";
      suggestion: string;
      captureId: number;
      model?: SuggestionModel;
      broadcast?: boolean;
    }
  | {
      type: "empty";
      reason:
        | "no-model"
        | "no-included-model"
        | "premium-quota-blocked"
        | "empty-response"
        | "request-timeout"
        | "too-short"
        | "duplicate-input"
        | "rate-limited"
        | "session-budget-exhausted";
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: "error";
      message: string;
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: "clear";
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: "draftSync";
      text: string;
      originViewId: string;
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: "draftHydrate";
      text: string;
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: "settings";
      settings: SettingsPayload;
      captureId?: number;
      broadcast?: boolean;
    };

export type UpdateSettingMessage =
  | { type: "updateSetting"; key: "suggestionModelPolicy"; value: "nonPremiumOnly" | "anyModel" }
  | { type: "updateSetting"; key: "selectedModelId"; value: string }
  | { type: "updateSetting"; key: "suggestionStyle"; value: "concise" | "balanced" | "detailed" }
  | { type: "updateSetting"; key: "contextMode"; value: "off" | "basic" | "project" }
  | { type: "updateSetting"; key: "suggestionLanguageChoice"; value: "auto" | "es" | "en" }
  | { type: "updateSetting"; key: "debugSuggestions"; value: boolean }
  | { type: "updateSetting"; key: "completionProvider"; value: CompletionProvider }
  | { type: "updateSetting"; key: "agentDestination"; value: AgentDestination };

export type OutboundMessage =
  | { type: "init" }
  | { type: "suggest"; text: string; captureId: number }
  | { type: "draftChanged"; text: string; originViewId: string }
  | { type: "accept"; context: string; suggestion: string }
  | { type: "send"; text: string }
  | UpdateSettingMessage;
