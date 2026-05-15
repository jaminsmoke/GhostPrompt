import * as vscode from 'vscode';

import { buildCompletionInstruction } from '../../sugcore/rules/instruction';
import { describeModel, selectModelByPolicy } from './catalog/modelCatalog';
import { collectResponseText } from '../../system/internals/streaming/collect';
import {
  DEFAULT_MAX_SUGGESTION_CHARS,
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
} from '../../system/internals/protocols/params';
import type { CompletionRequestOptions, CompletionResult } from '../../system/internals/protocols/types';

let premiumQuotaBlocked = false;

/**
 * Solicita una sugerencia a Copilot LM y normaliza el resultado para GhostPrompt.
 * @param {string} userText Texto de usuario actual que debe completarse.
 * @param {CompletionRequestOptions} options Configuración de la petición, incluyendo modelo, timeout y contexto.
 * @returns {Promise<CompletionResult>} Resultado de la petición de completado, con sugerencia o razón vacía.
 * @throws Cuando la petición se cancela mientras se procesa la respuesta.
 */
export async function requestCopilotLmCompletion(
  userText: string,
  options: CompletionRequestOptions,
): Promise<CompletionResult> {
  const {
    token,
    policy,
    preferredModelId,
    maxSuggestionChars = DEFAULT_MAX_SUGGESTION_CHARS,
    style: _style,
    context: _context,
    requestTimeoutMs = DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
    onLoadingPhase,
  } = options;
  if (policy === 'nonPremiumOnly' && premiumQuotaBlocked) {
    return { kind: 'empty', reason: 'premium-quota-blocked' };
  }

  const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
  if (!models.length) {
    return { kind: 'empty', reason: 'no-model' };
  }

  const model = selectModelByPolicy(models, policy, preferredModelId);
  if (!model) {
    return { kind: 'empty', reason: 'no-included-model' };
  }

  try {
    const instruction = buildCompletionInstruction(userText);
    let requestTokenSource: vscode.CancellationTokenSource | undefined;
    let requestCancellation: vscode.Disposable | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      onLoadingPhase?.('copilot');
      requestTokenSource = new vscode.CancellationTokenSource();
      requestCancellation = token.onCancellationRequested(() => {
        requestTokenSource!.cancel();
      });
      timeoutHandle = setTimeout(() => {
        requestTokenSource!.cancel();
      }, requestTimeoutMs);
      onLoadingPhase?.('copilot-generating');
      const response = await model.sendRequest(
        [vscode.LanguageModelChatMessage.User(instruction)],
        {},
        requestTokenSource.token,
      );

      const completion = await collectResponseText(response, requestTimeoutMs);
      if (looksLikeCopilotRefusal(completion)) {
        return { kind: 'empty', reason: 'content-blocked' };
      }
      const suggestion = completion.trimEnd().slice(0, maxSuggestionChars).trimEnd();
      if (!suggestion) {
        return { kind: 'empty', reason: 'empty-response' };
      }
      return { kind: 'suggestion', suggestion, model: describeModel(model) };
    } finally {
      clearTimeout(timeoutHandle);
      requestCancellation?.dispose();
      requestTokenSource?.dispose();
    }
  } catch (error) {
    if (token.isCancellationRequested) {
      throw error;
    }
    if (error instanceof Error && /request-timeout/i.test(error.message)) {
      return { kind: 'empty', reason: 'request-timeout' };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (policy === 'nonPremiumOnly' && isPremiumQuotaError(message)) {
      premiumQuotaBlocked = true;
      return { kind: 'empty', reason: 'premium-quota-blocked' };
    }
    return { kind: 'error', message };
  }
}

/**
 * Detecta si el mensaje de error coincide con el bloqueo de cuota premium de Copilot.
 * @param {string} message Mensaje devuelto por la API de Copilot.
 * @returns {boolean} True cuando el error indica que se alcanzó cuota premium.
 */
function isPremiumQuotaError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('premium model quota') ||
    normalized.includes('additional paid premium requests') ||
    normalized.includes('allowance to renew')
  );
}

/**
 * Comprueba si el texto devuelto por Copilot parece una negativa de asistencia.
 * @param {string} text Texto de respuesta del modelo.
 * @returns {boolean} True si el texto se interpreta como una negativa de servicio.
 */
function looksLikeCopilotRefusal(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith("i'm sorry") || normalized.startsWith('im sorry')) {
    return /assist|help|provide|cannot|can't|unable/.test(normalized);
  }
  return (
    normalized.includes("can't assist") ||
    normalized.includes('cannot assist') ||
    normalized.includes('unable to assist') ||
    normalized.includes("can't help") ||
    normalized.includes('cannot help') ||
    normalized.includes('unable to provide') ||
    normalized.includes('cannot provide')
  );
}
