/**
 * Orquestación del mensaje webview `suggest`: LM (Copilot/OpenCode) y broadcast UI.
 * Invocado desde `handleGhostPromptSuggest.ts` (wrapper estable para imports existentes).
 */
import { getCompletionProviderForSource } from '../../engines/engineRegistry';
import { getEnabledCompletionSources, resolveCompletionSourceForRequest } from '../sources';
import { suggestionLoadingStatusText, type SuggestionLoadingPhase } from '../loading';
import type { SuggestionModelPolicy, SuggestionStyle } from '../types';
import { logSuggestionDebug } from '../../system/debug/SuggestionDebug';
import { ghostPromptSessionStore } from '../session/GhostPromptSessionStore';
import { maybeNotifySuggestionIssue } from '../../ui/notifications/suggestionNotification';
import type { WebviewInboundMessage } from '../../api/protocols/webviewProtocols';

export type GhostPromptSuggestDeps = {
  broadcastUi: (payload: Record<string, unknown>) => void;
  getSuggestionModelPolicy: () => SuggestionModelPolicy;
  getSelectedModelId: () => string;
  getSuggestionStyle: () => SuggestionStyle;
  getMaxSuggestionChars: () => number;
};

/**
 * Ejecuta el flujo completo de suggestion para un par texto + captureId (tras validar entrada).
 * @param {WebviewInboundMessage} message Mensaje de sugerencia recibido desde el webview.
 * @param {GhostPromptSuggestDeps} deps Dependencias y callbacks necesarios para el pipeline.
 */
export async function runGhostPromptSuggestPipeline(
  message: Extract<WebviewInboundMessage, { type: 'suggest' }>,
  deps: GhostPromptSuggestDeps,
): Promise<void> {
  const { text, captureId } = message;
  if (!text) {
    return;
  }
  const policy = deps.getSuggestionModelPolicy();
  const selectedModelId = deps.getSelectedModelId();
  const style = deps.getSuggestionStyle();

  const tokenSource = ghostPromptSessionStore.prepareSuggestionRequest(captureId);

  const enabledSources = getEnabledCompletionSources();
  const routedSource = resolveCompletionSourceForRequest(selectedModelId, enabledSources);

  logSuggestionDebug(
    captureId,
    'request-start',
    `chars=${text.length} policy=${policy} selectedModelId=${selectedModelId} source=${routedSource} style=${style}`,
  );
  const initialPhase: SuggestionLoadingPhase =
    routedSource === 'opencode'
      ? 'opencode-start'
      : routedSource === 'ollama'
        ? 'ollama-start'
        : 'copilot';
  const emitLoadingPhase = (phase: SuggestionLoadingPhase) => {
    deps.broadcastUi({
      type: 'loading',
      captureId,
      phase,
      statusText: suggestionLoadingStatusText(phase),
    });
  };

  deps.broadcastUi({
    type: 'loading',
    captureId,
    phase: initialPhase,
    statusText: suggestionLoadingStatusText(initialPhase),
  });

  try {
    const result = await getCompletionProviderForSource(routedSource).requestCompletion(text, {
      perfCaptureId: captureId,
      token: tokenSource.token,
      policy,
      preferredModelId: selectedModelId === 'auto' ? undefined : selectedModelId,
      maxSuggestionChars: deps.getMaxSuggestionChars(),
      style,
      onLoadingPhase: emitLoadingPhase,
      ...(routedSource === 'opencode' || routedSource === 'ollama'
        ? {
            onStreamPreview: (accumulated: string) => {
              if (captureId !== ghostPromptSessionStore.getSnapshot().activeCaptureId) {
                return;
              }
              deps.broadcastUi({
                type: 'suggestion-stream',
                text: accumulated,
                captureId,
              });
            },
          }
        : {}),
    });

    if (
      tokenSource.token.isCancellationRequested ||
      captureId !== ghostPromptSessionStore.getSnapshot().activeCaptureId
    ) {
      logSuggestionDebug(captureId, 'request-discarded', 'stale-or-cancel');
      return;
    }

    if (result.kind === 'suggestion') {
      ghostPromptSessionStore.patchState({
        pendingSuggestion: result.suggestion,
        suggestionFlowStatus: 'success',
        lastEffectiveModel: result.model,
      });
      logSuggestionDebug(
        captureId,
        'request-success',
        `suggestionChars=${result.suggestion.length} model=${result.model?.id ?? 'unknown'} modelTier=${result.model?.tier ?? 'unknown'}`,
      );
      deps.broadcastUi({
        type: 'suggestion',
        suggestion: result.suggestion,
        ...(result.model ? { model: result.model } : {}),
        captureId,
      });
    } else if (result.kind === 'empty') {
      ghostPromptSessionStore.patchState({ suggestionFlowStatus: 'empty' });
      logSuggestionDebug(captureId, 'request-empty', `reason=${result.reason}`);
      deps.broadcastUi({
        type: 'empty',
        reason: result.reason,
        captureId,
      });
      maybeNotifySuggestionIssue(result);
    } else {
      ghostPromptSessionStore.patchState({
        suggestionFlowStatus: 'error',
        lastSuggestionError: result.message,
      });
      logSuggestionDebug(captureId, 'request-error', result.message);
      deps.broadcastUi({
        type: 'error',
        message: result.message,
        captureId,
      });
      maybeNotifySuggestionIssue(result);
    }
  } catch {
    logSuggestionDebug(captureId, 'request-cancelled');
  } finally {
    ghostPromptSessionStore.disposeActiveSuggestionToken(tokenSource);
    ghostPromptSessionStore.patchState({ suggestionFlowStatus: 'idle' });
  }
}
