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
import { ollamaModelManager } from "../../engines/ollama";
import { looksLikeOllamaModelId } from "../../core/sources";
import { parseWebviewOutboundMessage } from "./webviewProtocols";
import type { WebviewInboundMessage } from "./webviewProtocols";

export type GhostPromptInboundBroadcastServices = {
  broadcastDraftSync: (originViewId: string, text: string) => void;
  broadcastSettingsToAllViews: () => Promise<void>;
  broadcastClearAll: () => void;
  broadcastUi: (payload: Record<string, unknown>) => void;
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
  const draftPayload = {
    type: "draftHydrate" as const,
    text: ghostPromptSessionStore.getSnapshot().draftText,
  };
  parseWebviewOutboundMessage(draftPayload);
  webview.postMessage(draftPayload);
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

/**
 * Aplica un cambio de configuración originado en el webview y notifica a todas
 * las vistas. Efectos secundarios:
 * - Si se selecciona un modelo Ollama (`selectedModelId` con formato Ollama):
 *   detiene el modelo anterior, inicia el nuevo vía `ollamaModelManager`
 * - Si se cambia de motor (`completionProvider`) a != Ollama: detiene modelos Ollama
 *
 * @param message - Mensaje `updateSetting` del webview
 * @param broadcastSettingsToAllViews - Callback para re-enviar settings a todas las vistas
 * @param dispatchServices - Servicios de dispatch (broadcastUi, etc.), opcional
 */
export async function handleGhostPromptInboundUpdateSetting(
  message: Extract<WebviewInboundMessage, { type: "updateSetting" }>,
  broadcastSettingsToAllViews: () => Promise<void>,
  dispatchServices?: GhostPromptInboundDispatchServices,
): Promise<void> {
  await applyWebviewUpdateSetting(message);
  await broadcastSettingsToAllViews();

  if (message.key === "selectedModelId" && message.value && dispatchServices) {
    if (looksLikeOllamaModelId(message.value)) {
      ollamaModelManager.stopAll();
      ollamaModelManager.startModel(message.value).then(async () => {
        const providers = await providerStatusManager.refreshAll();
        dispatchServices!.broadcastUi({ type: "providerStatus", providers });
      }).catch(async () => {
        const providers = await providerStatusManager.refreshAll();
        dispatchServices!.broadcastUi({ type: "providerStatus", providers });
      });
    }
  }

  if (message.key === "completionProvider" && dispatchServices) {
    if (message.value !== "ollama") {
      ollamaModelManager.stopAll();
      const providers = await providerStatusManager.refreshAll();
      dispatchServices.broadcastUi({ type: "providerStatus", providers });
    }
  }
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
        dispatchServices,
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
      await handleProviderStatusRequest(dispatchServices.webview, dispatchServices);
      return;
    case "startProvider":
      await providerStatusManager.start(message.provider);
      await postProviderStatus(dispatchServices.webview, dispatchServices);
      return;
    case "stopProvider":
      await providerStatusManager.stop(message.provider);
      await postProviderStatus(dispatchServices.webview, dispatchServices);
      return;
    default: {
      const _exhaustiveCheck: never = message;
      void _exhaustiveCheck;
    }
  }
}

async function handleProviderStatusRequest(webview: vscode.Webview, services: GhostPromptInboundDispatchServices): Promise<void> {
  await postProviderStatus(webview, services);
}

async function postProviderStatus(webview: vscode.Webview, services: GhostPromptInboundDispatchServices): Promise<void> {
  const providers = await providerStatusManager.refreshAll();
  const msg = { type: "providerStatus" as const, providers };
  parseWebviewOutboundMessage(msg);
  webview.postMessage(msg);
  services.broadcastUi(msg);
}
