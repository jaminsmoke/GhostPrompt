/**
 * Handlers por `message.type` del canal webview → host (init, suggest, send, …).
 * Router: `dispatchGhostPromptInboundMessage`. Roadmap v0.3.2 fase A.
 */
import * as vscode from "vscode";
import {
  getActiveDestinationProvider,
  getGhostPromptAgentDestination,
} from "../../destinations/destinationRegistry";
import { append as appendLog } from '../../system/log/ConversationLog';
import { appendSuggestion } from '../../system/log/SuggestionLog';
import { ghostPromptSessionStore } from '../../core/session/GhostPromptSessionStore';
import { applyWebviewUpdateSetting } from "../settings/applyWebviewUpdate";
import { logDebugInfo } from '../../system/debug/SuggestionDebug';
import {
  type GhostPromptSuggestDeps,
  handleGhostPromptSuggest,
} from "../../core/pipeline";
import { providerStatusManager } from "../../system/status";
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
  if (getGhostPromptAgentDestination() === "vsOpenCodeX") {
    return;
  }
  if (!message.text) {
    return;
  }
  const provider = getActiveDestinationProvider();
  if (typeof provider.sendPrompt !== "function") {
    void vscode.window.showErrorMessage(
      `GhostPrompt: destino '${provider.id}' no tiene función de envío registrada.`,
    );
    return;
  }
  try {
    await provider.sendPrompt(message.text);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(
      `GhostPrompt: no se pudo enviar al destino '${provider.id}': ${messageText}`,
    );
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
  broadcastClearAll();
}

export async function dispatchGhostPromptInboundMessage(
  message: WebviewInboundMessage,
  services: GhostPromptInboundDispatchServices,
): Promise<void> {
  const dispatchServices = services satisfies GhostPromptInboundDispatchServices;
  logDebugInfo(`Dispatching inbound webview message type=${message.type}`);
  switch (message.type) {
    case "init":
      await handleGhostPromptInboundInit(dispatchServices.webview, dispatchServices.postSettings);
      return;
    case "draftChanged":
      handleGhostPromptInboundDraftChanged(message, dispatchServices);
      return;
    case "updateSetting":
      await handleGhostPromptInboundUpdateSetting(
        message,
        dispatchServices.broadcastSettingsToAllViews,
      );
      return;
    case "suggest":
      if (getGhostPromptAgentDestination() === "vsOpenCodeX") {
        return;
      }
      await handleGhostPromptSuggest(message, dispatchServices.suggestDeps);
      return;
    case "accept":
      await handleGhostPromptInboundAccept(message, dispatchServices.dataUri);
      return;
    case "send":
      await handleGhostPromptInboundSend(
        message,
        dispatchServices.dataUri,
        dispatchServices.broadcastClearAll,
      );
      return;
    case "requestProviderStatus":
      await handleProviderStatusRequest(dispatchServices.webview);
      return;
    case "startProvider":
      await providerStatusManager.start(message.provider);
      await postProviderStatus(dispatchServices.webview);
      return;
    case "stopProvider":
      await providerStatusManager.stop(message.provider);
      await postProviderStatus(dispatchServices.webview);
      return;
    default: {
      const _exhaustiveCheck: never = message;
      void _exhaustiveCheck;
    }
  }
}

async function handleProviderStatusRequest(webview: vscode.Webview): Promise<void> {
  await postProviderStatus(webview);
}

async function postProviderStatus(webview: vscode.Webview): Promise<void> {
  const providers = await providerStatusManager.refreshAll();
  webview.postMessage({ type: "providerStatus", providers });
}
