/**
 * Contratos Zod compartidos host ↔ webview (roadmap v0.3.2 fase C).
 * Consumidos por `src/host/webviewProtocols.ts` y empaquetados en el bundle webview.
 */
import { z } from "zod";

export const suggestionModelDescriptorSchema = z.object({
  id: z.string(),
  label: z.string(),
  tier: z.enum(["included", "premium", "unknown"]),
  pricing: z.string().optional(),
  provider: z.string().optional(),
  completionSource: z.enum(["copilot", "opencode", "ollama"]).optional(),
});

/** Payload `settings` dentro de `{ type: "settings", settings }` (host → webview). */
export const webviewSettingsPayloadSchema = z.object({
  completionProvider: z.enum(["copilot", "opencode", "ollama"]),
  completionUiKind: z.enum(["copilot", "opencode", "ollama", "multi"]),
  enabledCompletionSources: z.array(z.enum(["copilot", "opencode", "ollama"])),
  suggestionModelPolicy: z.enum(["nonPremiumOnly", "anyModel"]),
  selectedModelId: z.string(),
  availableModels: z.array(suggestionModelDescriptorSchema),
  suggestionStyle: z.enum(["concise", "balanced", "detailed"]),
  contextMode: z.enum(["off", "basic", "project"]),
  suggestionLanguageChoice: z.enum(["auto", "es", "en"]),
  effectiveSuggestionLanguage: z.enum(["es", "en"]),
  effectiveModel: suggestionModelDescriptorSchema.optional(),
  debugSuggestions: z.boolean(),
  /** Tiempo de inactividad tras teclear antes de pedir suggestion (webview debounce). */
  suggestionDebounceMs: z.number().min(150).max(2000),
  /** Destino del agente: Copilot Chat vs superficie VSOpenCodeX (v0.5 Fase C). */
  agentDestination: z.enum(["copilotChat", "vsOpenCodeX"]),
  /** Si la extensión VSOpenCodeX está instalada (control destino en webview). */
  vsOpenCodeXExtensionInstalled: z.boolean(),
});

export const webviewOutboundSettingsEnvelopeSchema = z.object({
  type: z.literal("settings"),
  settings: webviewSettingsPayloadSchema,
});

const providerStateRecordSchema = z.object({
  id: z.string(),
  kind: z.enum(["engine", "destination"]),
  status: z.enum(["running", "stopped", "starting", "unavailable", "error"]),
  label: z.string(),
  statusText: z.string().optional(),
  actions: z.array(z.enum(["start", "stop"])).optional(),
});

export const webviewOutboundProviderStatusSchema = z.object({
  type: z.literal("providerStatus"),
  providers: z.array(providerStateRecordSchema),
});

export const webviewOutboundLoadingSchema = z.object({
  type: z.literal("loading"),
  captureId: z.number(),
  phase: z.string().optional(),
  statusText: z.string().optional(),
  broadcast: z.boolean().optional(),
});

export const webviewOutboundSuggestionSchema = z.object({
  type: z.literal("suggestion"),
  suggestion: z.string(),
  captureId: z.number(),
  model: suggestionModelDescriptorSchema.optional(),
  broadcast: z.boolean().optional(),
});

export const webviewOutboundSuggestionStreamSchema = z.object({
  type: z.literal("suggestion-stream"),
  text: z.string(),
  captureId: z.number(),
  broadcast: z.boolean().optional(),
});

export const webviewOutboundEmptySchema = z.object({
  type: z.literal("empty"),
  reason: z.enum([
    "no-model",
    "no-included-model",
    "premium-quota-blocked",
    "empty-response",
    "request-timeout",
    "too-short",
    "duplicate-input",
    "rate-limited",
    "session-budget-exhausted",
  ]),
  captureId: z.number().optional(),
  broadcast: z.boolean().optional(),
});

export const webviewOutboundErrorSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
  captureId: z.number().optional(),
  broadcast: z.boolean().optional(),
});

export const webviewOutboundClearSchema = z.object({
  type: z.literal("clear"),
  captureId: z.number().optional(),
  broadcast: z.boolean().optional(),
});

export const webviewOutboundDraftHydrateSchema = z.object({
  type: z.literal("draftHydrate"),
  text: z.string(),
  captureId: z.number().optional(),
  broadcast: z.boolean().optional(),
});

export const webviewOutboundDraftSyncSchema = z.object({
  type: z.literal("draftSync"),
  text: z.string(),
  originViewId: z.string(),
  captureId: z.number().optional(),
  broadcast: z.boolean().optional(),
});

export const webviewOutboundLanguageEffectiveSchema = z.object({
  type: z.literal("languageEffective"),
  language: z.enum(["es", "en"]),
  captureId: z.number().optional(),
  broadcast: z.boolean().optional(),
});

/** Union discriminada de todos los mensajes host → webview. */
export const webviewOutboundMessageSchema = z.discriminatedUnion("type", [
  webviewOutboundSettingsEnvelopeSchema,
  webviewOutboundProviderStatusSchema,
  webviewOutboundLoadingSchema,
  webviewOutboundSuggestionSchema,
  webviewOutboundSuggestionStreamSchema,
  webviewOutboundEmptySchema,
  webviewOutboundErrorSchema,
  webviewOutboundClearSchema,
  webviewOutboundDraftHydrateSchema,
  webviewOutboundDraftSyncSchema,
  webviewOutboundLanguageEffectiveSchema,
]);

export type WebviewOutboundMessage = z.infer<typeof webviewOutboundMessageSchema>;

export type WebviewSettingsPayload = z.infer<typeof webviewSettingsPayloadSchema>;

export const webviewUpdateSettingSchema = z.discriminatedUnion("key", [
  z.object({
    type: z.literal("updateSetting"),
    key: z.literal("suggestionModelPolicy"),
    value: z.enum(["nonPremiumOnly", "anyModel"]),
  }),
  z.object({
    type: z.literal("updateSetting"),
    key: z.literal("selectedModelId"),
    value: z.string(),
  }),
  z.object({
    type: z.literal("updateSetting"),
    key: z.literal("suggestionStyle"),
    value: z.enum(["concise", "balanced", "detailed"]),
  }),
  z.object({
    type: z.literal("updateSetting"),
    key: z.literal("contextMode"),
    value: z.enum(["off", "basic", "project"]),
  }),
  z.object({
    type: z.literal("updateSetting"),
    key: z.literal("suggestionLanguageChoice"),
    value: z.enum(["auto", "es", "en"]),
  }),
  z.object({
    type: z.literal("updateSetting"),
    key: z.literal("debugSuggestions"),
    value: z.boolean(),
  }),
  z.object({
    type: z.literal("updateSetting"),
    key: z.literal("completionProvider"),
    value: z.enum(["copilot", "opencode", "ollama"]),
  }),
  z.object({
    type: z.literal("updateSetting"),
    key: z.literal("agentDestination"),
    value: z.enum(["copilotChat", "vsOpenCodeX"]),
  }),
]);

/** Mensajes recibidos desde el webview (webview → host); mismo contrato que salida del cliente. */
export const webviewInboundMessageSchema = z.union([
  z.object({ type: z.literal("init") }),
  z.object({
    type: z.literal("suggest"),
    text: z.string(),
    captureId: z.number(),
  }),
  z.object({
    type: z.literal("draftChanged"),
    text: z.string(),
    originViewId: z.string().min(1),
  }),
  z.object({
    type: z.literal("accept"),
    context: z.string(),
    suggestion: z.string(),
  }),
  z.object({
    type: z.literal("send"),
    text: z.string(),
  }),
  webviewUpdateSettingSchema,
  z.object({ type: z.literal("requestProviderStatus") }),
  z.object({ type: z.literal("startProvider"), provider: z.string() }),
  z.object({ type: z.literal("stopProvider"), provider: z.string() }),
]);

export type WebviewInboundMessage = z.infer<typeof webviewInboundMessageSchema>;
