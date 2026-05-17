/**
 * @file Orquestación del mensaje webview `suggest` (LM + broadcast UI).
 *
 * Orquestación del mensaje webview `suggest`: LM (Copilot/OpenCode) y broadcast UI.
 * Invocado desde `suggest/index.ts` (alias `handleGhostPromptSuggest` para imports existentes).
 */
import { getEnabledCompletionSources } from '../../engines/config/completionSources';
import { resolveCompletionSourceForRequest } from '../../engines/routing/resolveCompletionSource';
import { resolveProvider } from '../../engines/routing/resolveProvider';
import {
  suggestionLoadingStatusText,
  type SuggestionLoadingPhase,
} from "../internals/protocols/state/loading";
import {
  DEFAULT_MIN_SUGGEST_INPUT_CHARS,
  type CompletionResult,
  type SuggestionModelPolicy,
  type SuggestionStyle,
} from '../internals/protocols/types';
import { flushLogCapture, getLogger } from '../log';

import { finalizeEngineCompletionResult } from './finalizeEngineCompletionResult';
import { setLastEffectiveSuggestionModel } from './lastEffectiveSuggestionModel';
import { suggestionRequestCoordinator } from './suggestionRequestCoordinator';

import type { WebviewInboundMessage } from '../../api/protocols/webviewProtocols';
import type { ProviderId } from '../internals/protocols/state/provider';

export type NotifyIssueCallback = (result: CompletionResult) => void;

/**
 * Fase de carga inicial según el proveedor de completion enrutado.
 * @param {ProviderId} source - Proveedor que atenderá la petición.
 * @returns {SuggestionLoadingPhase} Fase inicial de carga para la UI.
 */
function initialSuggestionLoadingPhase(source: ProviderId): SuggestionLoadingPhase {
  if (source === 'opencode') {
    return 'opencode-start';
  }
  if (source === 'ollama') {
    return 'ollama-start';
  }
  return 'copilot';
}

export type GhostPromptSuggestDeps = {
  broadcastUi: (payload: Record<string, unknown>) => void;
  getSuggestionModelPolicy: () => SuggestionModelPolicy;
  getSelectedModelId: () => string;
  getSuggestionStyle: () => SuggestionStyle;
  getMaxSuggestionChars: () => number;
  notifyIssue?: NotifyIssueCallback;
};

/**
 * Ejecuta el flujo completo de suggestion para un par texto + captureId (tras validar entrada).
 * @param {WebviewInboundMessage} message - Mensaje de sugerencia recibido desde el webview.
 * @param {GhostPromptSuggestDeps} deps - Dependencias y callbacks necesarios para el pipeline.
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
  if (!trimmed || trimmed.length < DEFAULT_MIN_SUGGEST_INPUT_CHARS) {
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

  const tokenSource = suggestionRequestCoordinator.prepareRequest(captureId);

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
  const initialPhase = initialSuggestionLoadingPhase(routedSource);
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
    const rawResult = await resolveProvider(routedSource).requestCompletion(text, {
      perfCaptureId: captureId,
      token: tokenSource.token,
      policy,
      preferredModelId: selectedModelId === 'auto' ? undefined : selectedModelId,
      style,
      onLoadingPhase: emitLoadingPhase,
      ...routedSource === 'opencode' || routedSource === 'ollama'
        ? {
            onStreamPreview: (accumulated: string) => {
              if (!suggestionRequestCoordinator.isActiveCapture(captureId)) {
                return;
              }
              deps.broadcastUi({
                type: 'suggestion-stream',
                text: accumulated,
                captureId,
              });
            },
          }
        : {},
    });

    const result = finalizeEngineCompletionResult(rawResult, deps.getMaxSuggestionChars());

    if (
      tokenSource.token.isCancellationRequested ||
      !suggestionRequestCoordinator.isActiveCapture(captureId)
    ) {
      log.warn('request-discarded', { captureId, reason: 'stale-or-cancel' });
      return;
    }

    if (result.kind === 'suggestion') {
      setLastEffectiveSuggestionModel(result.model);
      log.info('request-success', {
        captureId,
        suggestionChars: result.suggestion.length,
        model: result.model?.id ?? 'unknown',
        modelTier: result.model?.tier ?? 'unknown',
      });
      deps.broadcastUi({
        type: 'suggestion',
        suggestion: result.suggestion,
        ...result.model ? { model: result.model } : {},
        captureId,
      });
    } else if (result.kind === 'empty') {
      log.info('request-empty', { captureId, reason: result.reason });
      deps.broadcastUi({
        type: 'empty',
        reason: result.reason,
        captureId,
      });
      deps.notifyIssue?.(result);
    } else {
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
    suggestionRequestCoordinator.disposeTokenIfActive(tokenSource);
  }
}

export { runGhostPromptSuggestPipeline as handleGhostPromptSuggest };
