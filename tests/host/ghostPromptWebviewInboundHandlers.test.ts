import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  appendSuggestionMock,
  appendLogMock,
  sendToChatMock,
  applyWebviewUpdateSettingMock,
  MockCancellationTokenSource,
} = vi.hoisted(() => ({
  appendSuggestionMock: vi.fn(),
  appendLogMock: vi.fn(),
  sendToChatMock: vi.fn(),
  applyWebviewUpdateSettingMock: vi.fn(),
  MockCancellationTokenSource: class {
    public token = { isCancellationRequested: false };
    public cancel(): void {
      this.token.isCancellationRequested = true;
    }
    public dispose(): void {}
  },
}));

vi.mock("vscode", () => ({
  CancellationTokenSource: MockCancellationTokenSource,
  Disposable: class {
    constructor(private readonly _fn: () => void) {}
    dispose(): void {
      this._fn();
    }
  },
  Uri: {
    joinPath: (...parts: Array<{ fsPath?: string } | string>) => ({
      fsPath: parts.map((p) => (typeof p === "string" ? p : p.fsPath ?? "")).join("/"),
    }),
  },
}));

vi.mock("../../src/log/SuggestionLog", () => ({
  appendSuggestion: appendSuggestionMock,
}));

vi.mock("../../src/log/ConversationLog", () => ({
  append: appendLogMock,
}));

vi.mock("../../src/bridge/ChatBridge", () => ({
  sendToChat: sendToChatMock,
}));

vi.mock("../../src/host/applyWebviewUpdateSetting", () => ({
  applyWebviewUpdateSetting: applyWebviewUpdateSettingMock,
}));

import type { Uri, Webview } from "vscode";
import { ghostPromptSessionStore } from "../../src/session/GhostPromptSessionStore";
import {
  dispatchGhostPromptInboundMessage,
  handleGhostPromptInboundDraftChanged,
  handleGhostPromptInboundInit,
  handleGhostPromptInboundSend,
  type GhostPromptInboundDispatchServices,
} from "../../src/host/ghostPromptWebviewInboundHandlers";
import type { GhostPromptSuggestDeps } from "../../src/host/handleGhostPromptSuggest";

function minimalSuggestDeps(): GhostPromptSuggestDeps {
  return {
    broadcastUi: vi.fn(),
    getSuggestionModelPolicy: () => "nonPremiumOnly",
    getSelectedModelId: () => "auto",
    getSuggestionStyle: () => "balanced",
    getContextMode: () => "basic",
    getSuggestionLanguageMode: () => "auto",
    getSuggestionLanguage: () => "en",
    getMaxSuggestionChars: () => 180,
    collectProjectContext: () => ({}),
  };
}

describe("ghostPromptWebviewInboundHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ghostPromptSessionStore.resetSessionState();
  });

  describe("handleGhostPromptInboundDraftChanged", () => {
    it("no actualiza el store si originViewId no coincide con la vista", () => {
      const broadcast = vi.fn();
      handleGhostPromptInboundDraftChanged(
        {
          type: "draftChanged",
          text: "hola",
          originViewId: "ghostPrompt.inputPanel",
        },
        {
          viewContributionId: "ghostPrompt.input",
          broadcastDraftSync: broadcast,
        },
      );
      expect(ghostPromptSessionStore.getSnapshot().draftText).toBe("");
      expect(broadcast).not.toHaveBeenCalled();
    });

    it("persiste el borrador y notifica a la otra vista", () => {
      const broadcast = vi.fn();
      handleGhostPromptInboundDraftChanged(
        {
          type: "draftChanged",
          text: "texto",
          originViewId: "ghostPrompt.input",
        },
        {
          viewContributionId: "ghostPrompt.input",
          broadcastDraftSync: broadcast,
        },
      );
      expect(ghostPromptSessionStore.getSnapshot().draftText).toBe("texto");
      expect(broadcast).toHaveBeenCalledWith("ghostPrompt.input", "texto");
    });
  });

  describe("handleGhostPromptInboundInit", () => {
    it("publica settings y rehidrata el borrador del store", async () => {
      ghostPromptSessionStore.patchState({ draftText: "persistido" });
      const postSettings = vi.fn().mockResolvedValue(undefined);
      const postMessage = vi.fn();
      const webview = { postMessage } as unknown as Webview;

      await handleGhostPromptInboundInit(webview, postSettings);

      expect(postSettings).toHaveBeenCalledWith(webview);
      expect(postMessage).toHaveBeenCalledWith({
        type: "draftHydrate",
        text: "persistido",
      });
    });
  });

  describe("handleGhostPromptInboundSend", () => {
    it("registra el envío, envía al chat y limpia vistas", async () => {
      const clearAll = vi.fn();
      const dataUri = { fsPath: "/global-store" } as Uri;

      await handleGhostPromptInboundSend(
        { type: "send", text: "prompt final" },
        dataUri,
        clearAll,
      );

      expect(ghostPromptSessionStore.getSnapshot().lastSentPrompt).toBe(
        "prompt final",
      );
      expect(appendLogMock).toHaveBeenCalledWith(dataUri, "prompt final");
      expect(sendToChatMock).toHaveBeenCalledWith("prompt final");
      expect(clearAll).toHaveBeenCalled();
    });

    it("no hace nada si text está vacío", async () => {
      await handleGhostPromptInboundSend(
        { type: "send", text: "" },
        { fsPath: "/g" } as Uri,
        vi.fn(),
      );
      expect(appendLogMock).not.toHaveBeenCalled();
      expect(sendToChatMock).not.toHaveBeenCalled();
    });
  });

  describe("dispatchGhostPromptInboundMessage", () => {
    it("enruta updateSetting a apply + refresh de settings", async () => {
      applyWebviewUpdateSettingMock.mockResolvedValue(undefined);
      const broadcastSettings = vi.fn().mockResolvedValue(undefined);
      const webview = {} as Webview;

      const services: GhostPromptInboundDispatchServices = {
        viewContributionId: "ghostPrompt.input",
        webview,
        dataUri: { fsPath: "/g" } as Uri,
        postSettings: vi.fn(),
        broadcastDraftSync: vi.fn(),
        broadcastSettingsToAllViews: broadcastSettings,
        broadcastClearAll: vi.fn(),
        suggestDeps: minimalSuggestDeps(),
      };

      await dispatchGhostPromptInboundMessage(
        {
          type: "updateSetting",
          key: "suggestionStyle",
          value: "concise",
        },
        services,
      );

      expect(applyWebviewUpdateSettingMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "updateSetting",
          key: "suggestionStyle",
          value: "concise",
        }),
      );
      expect(broadcastSettings).toHaveBeenCalled();
    });
  });
});
