/**
 * @file Motor de completions Copilot LM para GhostPrompt (`vscode.lm`).
 *
 * Errores de cuota premium: `system/internals/protocols/guards/copilotLm`.
 * Acotación y rechazo de contenido: `system/runtime/finalizeEngineCompletionResult`.
 */
import * as vscode from 'vscode';

import { buildCompletionInstruction } from '../../../../sugcore/rules/instruction';
import { isPremiumQuotaCopilotError } from '../../../../system/internals/protocols/guards/copilotLm';
import {
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
} from '../../../../system/internals/protocols/types/params';
import { describeModel, selectModelByPolicy } from '../catalog/modelCatalog';
import { collectLmResponse } from '../lm/collectLmResponse';

import type { CompletionRequestOptions, CompletionResult } from '../../../../system/internals/protocols/types';

let premiumQuotaBlocked = false;

/**
 * Solicita texto al LM de Copilot y devuelve el resultado crudo (sin acotación ni heurísticas de rechazo).
 * @param {string} userText Texto de usuario actual que debe completarse.
 * @param {CompletionRequestOptions} options Configuración de la petición, incluyendo modelo, timeout y contexto.
 * @returns {Promise<CompletionResult>} Resultado de la petición de completado.
 * @throws {Error} Cuando la petición se cancela mientras se procesa la respuesta.
 */
export async function requestCopilotLmCompletion(
  userText: string,
  options: CompletionRequestOptions,
): Promise<CompletionResult> {
  const {
    token,
    policy,
    preferredModelId,
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
        requestTokenSource?.cancel();
      });
      timeoutHandle = setTimeout(() => {
        requestTokenSource?.cancel();
      }, requestTimeoutMs);
      onLoadingPhase?.('copilot-generating');
      const response = await model.sendRequest(
        [vscode.LanguageModelChatMessage.User(instruction)],
        {},
        requestTokenSource.token,
      );

      const completion = await collectLmResponse(response, requestTimeoutMs);
      return { kind: 'suggestion', suggestion: completion, model: describeModel(model) };
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
    if (policy === 'nonPremiumOnly' && isPremiumQuotaCopilotError(message)) {
      premiumQuotaBlocked = true;
      return { kind: 'empty', reason: 'premium-quota-blocked' };
    }
    return { kind: 'error', message };
  }
}
