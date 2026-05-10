/**
 * Handlers por `message.type` del canal webview → host (init, suggest, send, …).
 * Router: `dispatchGhostPromptInboundMessage`. Roadmap v0.3.2 fase A.
 */
import * as vscode from "vscode";
import { sendToChat } from "../bridge/ChatBridge";
import { append as appendLog } from "../log/ConversationLog";
import { appendSuggestion } from "../log/SuggestionLog";
import { ghostPromptSessionStore } from "../session/GhostPromptSessionStore";
import { applyWebviewUpdateSetting } from "./applyWebviewUpdateSetting";
import {
  type GhostPromptSuggestDeps,
  handleGhostPromptSuggest,
} from "./handleGhostPromptSuggest";
import type { WebviewInboundMessage } from "./webviewProtocols";

export type GhostPromptInboundBroadcastServices = {
  broadcastDraftSync: (originViewId: string, text: string) => void;
  broadcastSettingsToAllViews: () => Promise<void>;
  broadcastClearAll: () => void;
};

export type GhostPromptInboundDispatchServices =
  GhostPromptInboundBroadcastServices & {
    viewContributionId: string;
    webview: vscode.Webview;
    /** `storageUri ?? globalStorageUri` del ExtensionContext (siempre hay `globalStorageUri`). */
    dataUri: vscode.Uri;
    postSettings: (webview: vscode.Webview) => Promise<void>;
    suggestDeps: GhostPromptSuggestDeps;
  };

export async function handleGhostPromptInboundInit(
  webview: vscode.Webview,
  postSettings: (w: vscode.Webview) => Promise<void>,
): Promise<void> {
  await postSettings(webview);
  webview.postMessage({
    type: "draftHydrate",
    text: ghostPromptSessionStore.getSnapshot().draftText,
  });
}

export function handleGhostPromptInboundDraftChanged(
  message: Extract<WebviewInboundMessage, { type: "draftChanged" }>,
  services: Pick<
    GhostPromptInboundDispatchServices,
    "viewContributionId" | "broadcastDraftSync"
  >,
): void {
  if (message.originViewId !== services.viewContributionId) {
    return;
  }
  ghostPromptSessionStore.patchState({ draftText: message.text });
  services.broadcastDraftSync(message.originViewId, message.text);
}

export async function handleGhostPromptInboundUpdateSetting(
  message: Extract<WebviewInboundMessage, { type: "updateSetting" }>,
  broadcastSettingsToAllViews: () => Promise<void>,
): Promise<void> {
  await applyWebviewUpdateSetting(message);
  await broadcastSettingsToAllViews();
}

export async function handleGhostPromptInboundAccept(
  message: Extract<WebviewInboundMessage, { type: "accept" }>,
  dataUri: vscode.Uri,
): Promise<void> {
  ghostPromptSessionStore.patchState({
    lastAcceptedSuggestion: message.suggestion,
  });
  await appendSuggestion(dataUri, message.context, message.suggestion);
}

export async function handleGhostPromptInboundSend(
  message: Extract<WebviewInboundMessage, { type: "send" }>,
  dataUri: vscode.Uri,
  broadcastClearAll: () => void,
): Promise<void> {
  if (!message.text) {
    return;
  }
  const recent = [
    message.text,
    ...ghostPromptSessionStore.getSnapshot().recentSentPrompts,
  ].slice(0, 5);
  ghostPromptSessionStore.patchState({
    lastSentPrompt: message.text,
    recentSentPrompts: recent,
    pendingSuggestion: "",
    draftText: "",
  });
  await appendLog(dataUri, message.text);
  await sendToChat(message.text);
  broadcastClearAll();
}

export async function dispatchGhostPromptInboundMessage(
  message: WebviewInboundMessage,
  services: GhostPromptInboundDispatchServices,
): Promise<void> {
  switch (message.type) {
    case "init":
      await handleGhostPromptInboundInit(services.webview, services.postSettings);
      return;
    case "draftChanged":
      handleGhostPromptInboundDraftChanged(message, services);
      return;
    case "updateSetting":
      await handleGhostPromptInboundUpdateSetting(
        message,
        services.broadcastSettingsToAllViews,
      );
      return;
    case "suggest":
      await handleGhostPromptSuggest(message, services.suggestDeps);
      return;
    case "accept":
      await handleGhostPromptInboundAccept(message, services.dataUri);
      return;
    case "send":
      await handleGhostPromptInboundSend(
        message,
        services.dataUri,
        services.broadcastClearAll,
      );
      return;
    default: {
      const _exhaustiveCheck: never = message;
      void _exhaustiveCheck;
    }
  }
}
