import { describe, expect, it } from "vitest";
import {
  parseOutboundSettingsEnvelope,
  parseWebviewInboundMessage,
  webviewInboundMessageSchema,
  webviewOutboundSettingsEnvelopeSchema,
  webviewSettingsPayloadSchema,
} from "../src/api/protocols/webviewProtocols";

const minimalSettingsPayload = {
  completionProvider: "copilot" as const,
  completionUiKind: "copilot" as const,
  enabledCompletionSources: ["copilot"] as const,
  suggestionModelPolicy: "nonPremiumOnly" as const,
  selectedModelId: "auto",
  availableModels: [] as const,
  suggestionStyle: "balanced" as const,
  suggestionLanguageChoice: "auto" as const,
  effectiveSuggestionLanguage: "en" as const,
  effectiveModel: undefined,
  debugSuggestions: false,
  suggestionDebounceMs: 800,
  agentDestination: "copilotChat" as const,
  vsOpenCodeXExtensionInstalled: false,
};

describe("webviewProtocols (v0.3.1 Fase B)", () => {
  it("acepta mensajes entrantes válidos", () => {
    expect(parseWebviewInboundMessage({ type: "init" })).toEqual({ type: "init" });
    expect(
      parseWebviewInboundMessage({
        type: "suggest",
        text: "hola",
        captureId: 1,
      }),
    ).toMatchObject({ type: "suggest", captureId: 1 });
    expect(
      parseWebviewInboundMessage({
        type: "draftChanged",
        text: "x",
        originViewId: "ghostPrompt.input",
      }),
    ).toMatchObject({ type: "draftChanged" });
    expect(
      parseWebviewInboundMessage({
        type: "updateSetting",
        key: "debugSuggestions",
        value: true,
      }),
    ).toMatchObject({ key: "debugSuggestions", value: true });
    expect(
      parseWebviewInboundMessage({
        type: "updateSetting",
        key: "selectedModelId",
        value: "openai/gpt-4",
      }),
    ).toMatchObject({ key: "selectedModelId" });
    expect(
      parseWebviewInboundMessage({
        type: "updateSetting",
        key: "agentDestination",
        value: "vsOpenCodeX",
      }),
    ).toMatchObject({ key: "agentDestination", value: "vsOpenCodeX" });
  });

  it("rechaza mensajes entrantes inválidos", () => {
    expect(parseWebviewInboundMessage(null)).toBeUndefined();
    expect(parseWebviewInboundMessage({})).toBeUndefined();
    expect(
      parseWebviewInboundMessage({
        type: "suggest",
        text: "x",
        captureId: "1",
      }),
    ).toBeUndefined();
    expect(
      parseWebviewInboundMessage({
        type: "updateSetting",
        key: "debugSuggestions",
        value: "true",
      }),
    ).toBeUndefined();
    expect(
      parseWebviewInboundMessage({
        type: "updateSetting",
        key: "suggestionStyle",
        value: "fancy",
      }),
    ).toBeUndefined();
    expect(
      parseWebviewInboundMessage({
        type: "updateSetting",
        key: "agentDestination",
        value: "other",
      }),
    ).toBeUndefined();
  });

  it("acepta sobre settings saliente válido", () => {
    const envelope = {
      type: "settings" as const,
      settings: {
        ...minimalSettingsPayload,
        availableModels: [
          {
            id: "m",
            label: "M",
            tier: "included" as const,
            completionSource: "copilot" as const,
          },
        ],
      },
    };
    expect(parseOutboundSettingsEnvelope(envelope)).toEqual(envelope);
    expect(webviewOutboundSettingsEnvelopeSchema.safeParse(envelope).success).toBe(
      true,
    );
  });

  it("rechaza settings saliente con tier inválido", () => {
    const bad = {
      type: "settings" as const,
      settings: {
        ...minimalSettingsPayload,
        availableModels: [{ id: "x", label: "X", tier: "free" }],
      },
    };
    expect(parseOutboundSettingsEnvelope(bad)).toBeUndefined();
  });

  it("webviewSettingsPayloadSchema coincide con modelo descriptor", () => {
    const r = webviewSettingsPayloadSchema.safeParse({
      ...minimalSettingsPayload,
      effectiveModel: {
        id: "a",
        label: "A",
        tier: "premium",
        pricing: "1x",
      },
    });
    expect(r.success).toBe(true);
  });

  it("webviewInboundMessageSchema cubre updateSetting discriminado", () => {
    const r = webviewInboundMessageSchema.safeParse({
      type: "updateSetting",
      key: "suggestionLanguageChoice",
      value: "es",
    });
    expect(r.success).toBe(true);
  });
});
