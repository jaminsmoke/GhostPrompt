/**
 * @file Barrel público de la API interna webview↔host.
 *
 * - **boundary/** — Validación Zod en el límite postMessage (con logging) y dispatch inbound.
 * - **settings/** — Ensamblador del envelope `settings` hacia el webview.
 * - Config lectura/escritura: `system/internals/config/read|write/`.
 */

// Boundary (postMessage host)
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
} from './boundary/webviewProtocols';

export {
  dispatchGhostPromptInboundMessage,
  handleGhostPromptInboundInit,
  handleGhostPromptInboundDraftChanged,
  handleGhostPromptInboundUpdateSetting,
  handleGhostPromptInboundAccept,
  handleGhostPromptInboundSend,
  type GhostPromptInboundBroadcastServices,
  type GhostPromptInboundDispatchServices,
} from './boundary/inboundHandlers';

// Config write
export { applyWebviewUpdateSetting } from '../system/internals/config/write/applyWebviewUpdateSetting';

// Settings envelope assembler
export {
  buildAndPostGhostPromptSettings,
  type GhostPromptSettingsGetters,
} from './settings/settingsPostMessage';

// Config read
export {
  collectGhostPromptProjectContext,
  getGhostPromptMaxSuggestionChars,
  getGhostPromptOllamaBaseUrl,
  getGhostPromptOllamaExcludedModelIds,
  getGhostPromptSelectedModelId,
  getGhostPromptSuggestionStyle,
  readGhostPromptSuggestionModelPolicy,
} from '../system/internals/config/read';

// Destinations (agente de envío)
export {
  type AgentDestination,
  getAgentDestination,
  isCursorDesktopHost,
  isVsOpenCodeXExtensionInstalled,
  parseAgentDestination,
} from '../destinations/destinationRegistry';
