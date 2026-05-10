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
  completionSource: z.enum(["copilot", "opencode"]).optional(),
});

/** Payload `settings` dentro de `{ type: "settings", settings }` (host → webview). */
export const webviewSettingsPayloadSchema = z.object({
  completionProvider: z.enum(["copilot", "opencode"]),
  completionUiKind: z.enum(["copilot", "opencode", "multi"]),
  enabledCompletionSources: z.array(z.enum(["copilot", "opencode"])),
  suggestionModelPolicy: z.enum(["nonPremiumOnly", "anyModel"]),
  selectedModelId: z.string(),
  availableModels: z.array(suggestionModelDescriptorSchema),
  suggestionStyle: z.enum(["concise", "balanced", "detailed"]),
  contextMode: z.enum(["off", "basic", "project"]),
  suggestionLanguageChoice: z.enum(["auto", "es", "en"]),
  effectiveSuggestionLanguage: z.enum(["es", "en"]),
  effectiveModel: suggestionModelDescriptorSchema.optional(),
  debugSuggestions: z.boolean(),
});

export const webviewOutboundSettingsEnvelopeSchema = z.object({
  type: z.literal("settings"),
  settings: webviewSettingsPayloadSchema,
});

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
]);

export type WebviewInboundMessage = z.infer<typeof webviewInboundMessageSchema>;
