/**
 * Orquestación del mensaje webview `suggest`: LM (Copilot/OpenCode) y broadcast UI.
 * Invocado desde `suggest/index.ts` (alias `handleGhostPromptSuggest` para imports existentes).
 */
import { getCompletionProviderForSource } from '../../engines/engineRegistry';
import { getEnabledCompletionSources, resolveCompletionSourceForRequest } from '../routing/sources';
import { suggestionLoadingStatusText, type SuggestionLoadingPhase } from '../presentation/loading';
import type { CompletionResult, SuggestionModelPolicy, SuggestionStyle } from '../types';
import { flushLogCapture, getLogger } from '../../system/log';
import { ghostPromptSessionStore } from '../state/GhostPromptSessionStore';
import type { WebviewInboundMessage } from '../../api/protocols/webviewProtocols';

export type NotifyIssueCallback = (result: CompletionResult) => void;

export type GhostPromptSuggestDeps = {
  broadcastUi: (payload: Record<string, unknown>) => void;
  getSuggestionModelPolicy: () => SuggestionModelPolicy;
  getSelectedModelId: () => string;
  getSuggestionStyle: () => SuggestionStyle;
  getMaxSuggestionChars: () => number;
  notifyIssue?: NotifyIssueCallback;
};

/** Mínimo de caracteres no vacíos tras `trim` para invocar al LM (evita ruido y coste). */
const MIN_SUGGEST_INPUT_CHARS = 3;

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
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < MIN_SUGGEST_INPUT_CHARS) {
    deps.broadcastUi({
      type: 'empty',
      reason: 'too-short',
      captureId,
    });
    return;
  }
  const policy = deps.getSuggestionModelPolicy();
  const selectedModelId = deps.getSelectedModelId();
  const style = deps.getSuggestionStyle();

  const log = getLogger('suggest');

  const tokenSource = ghostPromptSessionStore.prepareSuggestionRequest(captureId);

  const enabledSources = getEnabledCompletionSources();
  const routedSource = resolveCompletionSourceForRequest(selectedModelId, enabledSources);

  log.info('request-start', {
    captureId,
    chars: text.length,
    policy,
    selectedModelId,
    source: routedSource,
    style,
  });
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
      log.warn('request-discarded', { captureId, reason: 'stale-or-cancel' });
      return;
    }

    if (result.kind === 'suggestion') {
      ghostPromptSessionStore.patchState({
        pendingSuggestion: result.suggestion,
        suggestionFlowStatus: 'success',
        lastEffectiveModel: result.model,
      });
      log.info('request-success', {
        captureId,
        suggestionChars: result.suggestion.length,
        model: result.model?.id ?? 'unknown',
        modelTier: result.model?.tier ?? 'unknown',
      });
      deps.broadcastUi({
        type: 'suggestion',
        suggestion: result.suggestion,
        ...(result.model ? { model: result.model } : {}),
        captureId,
      });
    } else if (result.kind === 'empty') {
      ghostPromptSessionStore.patchState({ suggestionFlowStatus: 'empty' });
      log.info('request-empty', { captureId, reason: result.reason });
      deps.broadcastUi({
        type: 'empty',
        reason: result.reason,
        captureId,
      });
      deps.notifyIssue?.(result);
    } else {
      ghostPromptSessionStore.patchState({
        suggestionFlowStatus: 'error',
        lastSuggestionError: result.message,
      });
      log.error('request-error', { captureId, detail: result.message });
      deps.broadcastUi({
        type: 'error',
        message: result.message,
        captureId,
      });
      deps.notifyIssue?.(result);
    }
  } catch {
    log.warn('request-cancelled', { captureId });
  } finally {
    flushLogCapture(captureId);
    ghostPromptSessionStore.disposeActiveSuggestionToken(tokenSource);
    ghostPromptSessionStore.patchState({ suggestionFlowStatus: 'idle' });
  }
}
