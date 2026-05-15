export type GhostPromptCapabilities = {
  compactToolbar?: boolean;
};

declare global {
  interface Window {
    __ghostPromptViewId?: string;
    __ghostPromptCapabilities?: GhostPromptCapabilities;
  }
}

export type AgentDestination = 'copilotChat' | 'vsOpenCodeX' | 'cursorChat';

export type CompletionProvider = 'copilot' | 'opencode' | 'ollama';

export type SuggestionModel = {
  id: string;
  label: string;
  tier: 'included' | 'premium' | 'unknown';
  pricing?: string;
  provider?: string;
  completionSource?: CompletionProvider;
};

export type SettingsPayload = {
  completionProvider: CompletionProvider;
  completionUiKind: 'copilot' | 'opencode' | 'ollama' | 'multi';
  enabledCompletionSources: CompletionProvider[];
  suggestionModelPolicy: 'nonPremiumOnly' | 'anyModel';
  selectedModelId: string;
  availableModels: SuggestionModel[];
  suggestionStyle: 'concise' | 'balanced' | 'detailed';
  effectiveModel?: SuggestionModel;
  debugSuggestions: boolean;
  suggestionDebounceMs: number;
  agentDestination: AgentDestination;
  vsOpenCodeXExtensionInstalled: boolean;
  cursorDesktopHost: boolean;
};

export type InboundMessage =
  | {
      type: 'loading';
      captureId: number;
      broadcast?: boolean;
      phase?: string;
      statusText?: string;
    }
  | {
      type: 'suggestion-stream';
      text: string;
      captureId: number;
      broadcast?: boolean;
    }
  | {
      type: 'suggestion';
      suggestion: string;
      captureId: number;
      model?: SuggestionModel;
      broadcast?: boolean;
    }
  | {
      type: 'empty';
      reason:
        | 'no-model'
        | 'no-included-model'
        | 'premium-quota-blocked'
        | 'empty-response'
        | 'request-timeout'
        | 'too-short'
        | 'duplicate-input'
        | 'rate-limited'
        | 'session-budget-exhausted'
        | 'content-blocked';
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: 'error';
      message: string;
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: 'clear';
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: 'draftSync';
      text: string;
      originViewId: string;
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: 'draftHydrate';
      text: string;
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: 'settings';
      settings: SettingsPayload;
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: 'providerStatus';
      providers: ProviderStateRecord[];
      captureId?: number;
      broadcast?: boolean;
    };

export type ProviderState = 'running' | 'stopped' | 'starting' | 'unavailable' | 'error';

export interface ProviderStateRecord {
  id: string;
  kind: 'engine' | 'destination';
  status: ProviderState;
  label: string;
  statusText?: string;
  actions?: ('start' | 'stop')[];
}

export type UpdateSettingMessage =
  | { type: 'updateSetting'; key: 'suggestionModelPolicy'; value: 'nonPremiumOnly' | 'anyModel' }
  | { type: 'updateSetting'; key: 'selectedModelId'; value: string }
  | { type: 'updateSetting'; key: 'suggestionStyle'; value: 'concise' | 'balanced' | 'detailed' }
  | { type: 'updateSetting'; key: 'debugSuggestions'; value: boolean }
  | { type: 'updateSetting'; key: 'completionProvider'; value: CompletionProvider }
  | { type: 'updateSetting'; key: 'agentDestination'; value: AgentDestination };

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type OutboundMessage =
  | { type: 'init' }
  | { type: 'suggest'; text: string; captureId: number }
  | { type: 'draftChanged'; text: string; originViewId: string }
  | { type: 'accept'; context: string; suggestion: string }
  | { type: 'send'; text: string }
  | { type: 'requestProviderStatus' }
  | { type: 'startProvider'; provider: string }
  | { type: 'stopProvider'; provider: string }
  | {
      type: 'log';
      level: LogLevel;
      message: string;
      data?: Record<string, unknown>;
      captureId?: number;
    }
  | UpdateSettingMessage;
