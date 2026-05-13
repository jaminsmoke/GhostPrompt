/**
 * Orquestación del mensaje webview `suggest`: gobernador, caché, LM (Copilot/OpenCode) y broadcast UI.
 * Invocado desde `handleGhostPromptSuggest.ts` (wrapper estable para imports existentes).
 */
import {
  collectProjectBootstrapPieces,
  fingerprintProjectBootstrapLines,
  resolveGhostPromptWorkspaceFolderUri,
  type ProjectBootstrapPiece,
  sortProjectBootstrapPieces,
} from '../context/projectBootstrapContext';
import {
  getCompletionProviderForSource,
} from '../../engines/engineRegistry';
import {
  getEnabledCompletionSources,
  resolveCompletionSourceForRequest,
} from '../sources';
import { resolveSuggestionLanguage } from '../language';
import {
  suggestionLoadingStatusText,
  type SuggestionLoadingPhase,
} from '../loading';
import type {
  SuggestionLanguageMode,
  SuggestionModelPolicy,
  SuggestionStyle,
  SupportedSuggestionLanguage,
} from '../types';
import type { Uri } from "vscode";
import type { ProjectMemoryReconcileSnapshot } from "../memory/persist";
import { logSuggestionDebug } from '../../system/debug/SuggestionDebug';
import { SuggestionRequestGovernor } from '../governor/SuggestionRequestGovernor';
import { ghostPromptSessionStore } from '../session/GhostPromptSessionStore';
import { maybeNotifySuggestionIssue } from "../../ui/notifications/suggestionNotification";
import type { WebviewInboundMessage } from "../../api/protocols/webviewProtocols";

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
  reconcileGhostPromptBootstrap?: (params: {
    workspaceRootUriString: string;
    workspaceFolderUri: Uri;
    livePieces: readonly ProjectBootstrapPiece[];
  }) => Promise<ProjectMemoryReconcileSnapshot>;

  writeGhostPromptBootstrapSnapshot?: (
    snapshot: ProjectMemoryReconcileSnapshot,
  ) => Promise<void>;
};

/**
 * Ejecuta el flujo completo de suggestion para un par texto + captureId (tras validar entrada).
 */
export async function runGhostPromptSuggestPipeline(
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

  let projectBootstrapLines: readonly string[] = [];
  let projectBootstrapFingerprint = "";
  let projectBootstrapReconcile: ProjectMemoryReconcileSnapshot | undefined;
  if (contextMode === "project") {
    const folderUri = resolveGhostPromptWorkspaceFolderUri();
    const pieces = await collectProjectBootstrapPieces(folderUri);
    if (
      folderUri &&
      deps.reconcileGhostPromptBootstrap &&
      deps.writeGhostPromptBootstrapSnapshot
    ) {
      projectBootstrapReconcile = await deps.reconcileGhostPromptBootstrap({
        workspaceRootUriString: folderUri.toString(),
        workspaceFolderUri: folderUri,
        livePieces: pieces,
      });
      projectBootstrapLines = projectBootstrapReconcile.promptLines;
    } else {
      projectBootstrapLines = sortProjectBootstrapPieces(pieces).map((p) => p.promptLine);
    }
    projectBootstrapFingerprint = fingerprintProjectBootstrapLines(projectBootstrapLines);
  }

  const governor = SuggestionRequestGovernor.shared;
  const governorConfig = SuggestionRequestGovernor.fromWorkspace();
  const decision = governor.decide(text, governorConfig, {
    language: effectiveLanguage,
    style,
    contextMode,
    modelPolicy: policy,
    selectedModelId,
    ...(contextMode === "project" ? { projectBootstrapFingerprint } : {}),
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
      maybeNotifySuggestionIssue(decision.result);
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
      maybeNotifySuggestionIssue(decision.result);
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
    maybeNotifySuggestionIssue({ kind: "empty", reason: decision.reason });
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
    routedSource === "opencode" ? "opencode-start" :
    routedSource === "ollama" ? "ollama-start" : "copilot";
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
    if (
      projectBootstrapReconcile &&
      deps.writeGhostPromptBootstrapSnapshot
    ) {
      await deps.writeGhostPromptBootstrapSnapshot(projectBootstrapReconcile);
    }
    const projectContext =
      contextMode === "project" ? deps.collectProjectContext() : {};
    const result = await getCompletionProviderForSource(
      routedSource,
    ).requestCompletion(text, {
      perfCaptureId: captureId,
      token: tokenSource.token,
      policy,
      preferredModelId: selectedModelId === "auto" ? undefined : selectedModelId,
      maxSuggestionChars: deps.getMaxSuggestionChars(),
      style,
      onLoadingPhase: emitLoadingPhase,
      ...(routedSource === "opencode" || routedSource === "ollama"
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
        ...(contextMode === "project" && projectBootstrapLines.length
          ? { projectBootstrapLines }
          : {}),
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
      maybeNotifySuggestionIssue(result);
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
      maybeNotifySuggestionIssue(result);
    }
  } catch {
    logSuggestionDebug(captureId, "request-cancelled");
  } finally {
    ghostPromptSessionStore.disposeActiveSuggestionToken(tokenSource);
    ghostPromptSessionStore.patchState({ suggestionFlowStatus: "idle" });
  }
}
