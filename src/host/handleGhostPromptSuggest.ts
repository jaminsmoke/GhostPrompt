/**
 * Maneja el mensaje webview `suggest`: gobernador, caché, Copilot/OpenCode y broadcast UI.
 */
import {
  getCompletionProviderForSource,
  getEnabledCompletionSources,
  resolveCompletionSourceForRequest,
  resolveSuggestionLanguage,
  suggestionLoadingStatusText,
  type SuggestionLoadingPhase,
  type SuggestionLanguageMode,
  type SuggestionModelPolicy,
  type SuggestionStyle,
  type SupportedSuggestionLanguage,
} from "../completion";
import { logSuggestionDebug } from "../debug/SuggestionDebug";
import { SuggestionRequestGovernor } from "../governor/SuggestionRequestGovernor";
import { ghostPromptSessionStore } from "../session/GhostPromptSessionStore";
import type { WebviewInboundMessage } from "./webviewProtocols";

export type GhostPromptSuggestDeps = {
  broadcastUi: (payload: Record<string, unknown>) => void;
  getSuggestionModelPolicy: () => SuggestionModelPolicy;
  getSelectedModelId: () => string;
  getSuggestionStyle: () => SuggestionStyle;
  getContextMode: () => "off" | "basic" | "project";
  getSuggestionLanguageMode: () => SuggestionLanguageMode;
  getSuggestionLanguage: () => SupportedSuggestionLanguage;
  getMaxSuggestionChars: () => number;
  collectProjectContext: () => {
    workspaceName?: string;
    activeFilePath?: string;
    activeLanguageId?: string;
    activeSelection?: string;
  };
};

export async function handleGhostPromptSuggest(
  message: Extract<WebviewInboundMessage, { type: "suggest" }>,
  deps: GhostPromptSuggestDeps,
): Promise<void> {
  const { text, captureId } = message;
  if (!text) {
    return;
  }
  const policy = deps.getSuggestionModelPolicy();
  const selectedModelId = deps.getSelectedModelId();
  const style = deps.getSuggestionStyle();
  const contextMode = deps.getContextMode();
  const languageMode = deps.getSuggestionLanguageMode();
  const effectiveLanguage = resolveSuggestionLanguage(
    languageMode,
    deps.getSuggestionLanguage(),
    text,
    ghostPromptSessionStore.getSnapshot().lastEffectiveSuggestionLanguage,
  );

  const governor = SuggestionRequestGovernor.shared;
  const governorConfig = SuggestionRequestGovernor.fromWorkspace();
  const decision = governor.decide(text, governorConfig, {
    language: effectiveLanguage,
    style,
    contextMode,
    modelPolicy: policy,
    selectedModelId,
  });
  const usage = governor.getUsageSnapshot(governorConfig);

  if (decision.kind === "serve-cache") {
    logSuggestionDebug(
      captureId,
      "request-cache-hit",
      `metrics=${JSON.stringify(governor.getMetrics())} usage=${JSON.stringify(usage)}`,
    );
    if (decision.result.kind === "suggestion") {
      ghostPromptSessionStore.patchState({
        pendingSuggestion: decision.result.suggestion,
        suggestionFlowStatus: "success",
        ...(decision.result.model
          ? { lastEffectiveModel: decision.result.model }
          : {}),
      });
      deps.broadcastUi({
        type: "suggestion",
        suggestion: decision.result.suggestion,
        ...(decision.result.model ? { model: decision.result.model } : {}),
        captureId,
      });
    } else if (decision.result.kind === "empty") {
      ghostPromptSessionStore.patchState({ suggestionFlowStatus: "empty" });
      deps.broadcastUi({
        type: "empty",
        reason: decision.result.reason,
        captureId,
      });
    } else {
      ghostPromptSessionStore.patchState({
        suggestionFlowStatus: "error",
        lastSuggestionError: decision.result.message,
      });
      deps.broadcastUi({
        type: "error",
        message: decision.result.message,
        captureId,
      });
    }
    return;
  }

  if (decision.kind === "block") {
    logSuggestionDebug(
      captureId,
      "request-blocked",
      `reason=${decision.reason} metrics=${JSON.stringify(governor.getMetrics())} usage=${JSON.stringify(usage)}`,
    );
    ghostPromptSessionStore.patchState({ suggestionFlowStatus: "empty" });
    deps.broadcastUi({
      type: "empty",
      reason: decision.reason,
      captureId,
    });
    return;
  }

  const tokenSource = ghostPromptSessionStore.prepareSuggestionRequest(captureId);

  const enabledSources = getEnabledCompletionSources();
  const routedSource = resolveCompletionSourceForRequest(
    selectedModelId,
    enabledSources,
  );

  logSuggestionDebug(
    captureId,
    "request-start",
    `chars=${text.length} policy=${policy} selectedModelId=${selectedModelId} source=${routedSource} style=${style} lang=${effectiveLanguage} metrics=${JSON.stringify(governor.getMetrics())} usage=${JSON.stringify(usage)}`,
  );
  const initialPhase: SuggestionLoadingPhase =
    routedSource === "opencode" ? "opencode-start" : "copilot";
  const emitLoadingPhase = (phase: SuggestionLoadingPhase) => {
    deps.broadcastUi({
      type: "loading",
      captureId,
      phase,
      statusText: suggestionLoadingStatusText(phase),
    });
  };

  deps.broadcastUi({
    type: "loading",
    captureId,
    phase: initialPhase,
    statusText: suggestionLoadingStatusText(initialPhase),
  });

  try {
    ghostPromptSessionStore.patchState({
      lastEffectiveSuggestionLanguage: effectiveLanguage,
    });
    deps.broadcastUi({
      type: "languageEffective",
      language: effectiveLanguage,
    });
    const projectContext =
      contextMode === "project" ? deps.collectProjectContext() : {};
    const result = await getCompletionProviderForSource(
      routedSource,
    ).requestCompletion(text, {
      token: tokenSource.token,
      policy,
      preferredModelId: selectedModelId === "auto" ? undefined : selectedModelId,
      maxSuggestionChars: deps.getMaxSuggestionChars(),
      style,
      onLoadingPhase: emitLoadingPhase,
      ...(routedSource === "opencode"
        ? {
            onStreamPreview: (accumulated: string) => {
              if (
                captureId !== ghostPromptSessionStore.getSnapshot().activeCaptureId
              ) {
                return;
              }
              deps.broadcastUi({
                type: "suggestion-stream",
                text: accumulated,
                captureId,
              });
            },
          }
        : {}),
      context: {
        lastAcceptedSuggestion:
          contextMode === "off"
            ? undefined
            : ghostPromptSessionStore.getSnapshot().lastAcceptedSuggestion,
        lastSentPrompt:
          contextMode === "off"
            ? undefined
            : ghostPromptSessionStore.getSnapshot().lastSentPrompt,
        recentSentPrompts:
          contextMode === "off"
            ? undefined
            : ghostPromptSessionStore.getSnapshot().recentSentPrompts.slice(0, 3),
        outputLanguage: effectiveLanguage,
        ...projectContext,
      },
    });
    governor.saveResult(decision.key, result, governorConfig);
    if (
      tokenSource.token.isCancellationRequested ||
      captureId !== ghostPromptSessionStore.getSnapshot().activeCaptureId
    ) {
      logSuggestionDebug(captureId, "request-discarded", "stale-or-cancel");
      return;
    }

    if (result.kind === "suggestion") {
      ghostPromptSessionStore.patchState({
        pendingSuggestion: result.suggestion,
        suggestionFlowStatus: "success",
        lastEffectiveModel: result.model,
      });
      logSuggestionDebug(
        captureId,
        "request-success",
        `suggestionChars=${result.suggestion.length} model=${result.model?.id ?? "unknown"} modelTier=${result.model?.tier ?? "unknown"} usage=${JSON.stringify(governor.getUsageSnapshot(governorConfig))}`,
      );
      deps.broadcastUi({
        type: "suggestion",
        suggestion: result.suggestion,
        ...(result.model ? { model: result.model } : {}),
        captureId,
      });
    } else if (result.kind === "empty") {
      ghostPromptSessionStore.patchState({ suggestionFlowStatus: "empty" });
      logSuggestionDebug(captureId, "request-empty", `reason=${result.reason}`);
      deps.broadcastUi({
        type: "empty",
        reason: result.reason,
        captureId,
      });
    } else {
      ghostPromptSessionStore.patchState({
        suggestionFlowStatus: "error",
        lastSuggestionError: result.message,
      });
      logSuggestionDebug(captureId, "request-error", result.message);
      deps.broadcastUi({
        type: "error",
        message: result.message,
        captureId,
      });
    }
  } catch {
    // Request cancelada por una pulsación más reciente.
    logSuggestionDebug(captureId, "request-cancelled");
  } finally {
    ghostPromptSessionStore.disposeActiveSuggestionToken(tokenSource);
    ghostPromptSessionStore.patchState({ suggestionFlowStatus: "idle" });
  }
}
