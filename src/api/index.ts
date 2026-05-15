/**
 * @file Barrel público de la API interna webview↔host.
 *
 * La API interna de GhostPrompt gestiona toda la comunicación entre el webview
 * (UI del mini-input) y el extension host. Se organiza en tres subdominios:
 *
 * - **protocols/** — Validación Zod en el boundary postMessage, router de mensajes inbound.
 * - **settings/** — Construcción/envío del envelope `settings`, aplicación de `updateSetting`.
 * - **getters/** — Lectores de configuración `vscode.workspace` + resolución de destino agente.
 */

// Protocols
export {
  parseWebviewInboundMessage,
  parseOutboundSettingsEnvelope,
  suggestionModelDescriptorSchema,
  webviewInboundMessageSchema,
  webviewOutboundSettingsEnvelopeSchema,
  webviewSettingsPayloadSchema,
  webviewUpdateSettingSchema,
  type WebviewInboundMessage,
  type WebviewSettingsPayload,
} from './protocols/webviewProtocols';

export {
  dispatchGhostPromptInboundMessage,
  handleGhostPromptInboundInit,
  handleGhostPromptInboundDraftChanged,
  handleGhostPromptInboundUpdateSetting,
  handleGhostPromptInboundAccept,
  handleGhostPromptInboundSend,
  type GhostPromptInboundBroadcastServices,
  type GhostPromptInboundDispatchServices,
} from './protocols/inboundHandlers';

// Settings
export { applyWebviewUpdateSetting } from './settings/applyWebviewUpdate';
export {
  buildAndPostGhostPromptSettings,
  type GhostPromptSettingsGetters,
} from './settings/settingsPostMessage';

// Getters
export {
  type GhostPromptAgentDestination,
  getGhostPromptAgentDestination,
  isVsOpenCodeXExtensionInstalled,
  getGhostPromptSuggestionModelPolicy,
  getGhostPromptSelectedModelId,
  getGhostPromptMaxSuggestionChars,
  getGhostPromptSuggestionStyle,
  getGhostPromptSuggestionLanguageMode,
  getGhostPromptSuggestionLanguage,
  getGhostPromptSuggestionLanguageChoice,
  getGhostPromptOllamaBaseUrl,
  getGhostPromptOllamaExcludedModelIds,
  collectGhostPromptProjectContext,
} from './getters/workspaceGetters';
