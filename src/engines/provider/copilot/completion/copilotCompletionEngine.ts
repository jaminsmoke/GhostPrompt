/**
 * @file Motor de completions Copilot LM para GhostPrompt (`vscode.lm`).
 *
 * Errores de cuota premium: `system/internals/protocols/guards/guardCopilotLm`.
 * Acotación y rechazo de contenido: `system/runtime/finalizeEngineCompletionResult`.
 */
import * as vscode from 'vscode';

import { buildCompletionInstruction } from '../../../../sugcore/rules/instruction';
import { isPremiumQuotaCopilotError } from '../../../../system/internals/protocols/guards/guardCopilotLm';
import {
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
  type CompletionRequestOptions,
  type CompletionResult,
} from '../../../../system/internals/protocols/types';
import { describeModel, selectModelByPolicy } from '../catalog/modelCatalog';
import { collectLmResponse } from '../lm/collectLmResponse';

const premiumQuotaBlockedState = { value: false };

/**
 * Clasifica un error de Copilot LM sin operaciones asíncronas (compatible con `require-atomic-updates`).
 * @param {unknown} error - Error capturado en la petición.
 * @param {CompletionRequestOptions['policy']} policy - Política de modelo activa.
 * @returns {CompletionResult} Resultado vacío, de error o cuota premium bloqueada.
 */
function mapCopilotCompletionError(
  error: unknown,
  policy: CompletionRequestOptions['policy'],
): CompletionResult {
  if (error instanceof Error && /request-timeout/iu.test(error.message)) {
    return { kind: 'empty', reason: 'request-timeout' };
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  if (policy === 'nonPremiumOnly' && isPremiumQuotaCopilotError(message)) {
    premiumQuotaBlockedState.value = true;
    return { kind: 'empty', reason: 'premium-quota-blocked' };
  }
  return { kind: 'error', message };
}

/**
 * Solicita texto al LM de Copilot y devuelve el resultado crudo (sin acotación ni heurísticas de rechazo).
 * @param {string} userText - Texto de usuario actual que debe completarse.
 * @param {CompletionRequestOptions} options - Configuración de la petición, incluyendo modelo, timeout y contexto.
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
  if (policy === 'nonPremiumOnly' && premiumQuotaBlockedState.value) {
    return { kind: 'empty', reason: 'premium-quota-blocked' };
  }

  const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
  if (models.length === 0) {
    return { kind: 'empty', reason: 'no-model' };
  }

  const model = selectModelByPolicy(models, policy, preferredModelId);
  if (!model) {
    return { kind: 'empty', reason: 'no-included-model' };
  }

  try {
    const instruction = buildCompletionInstruction(userText);
    let requestTokenSource: vscode.CancellationTokenSource | false = false;
    let requestCancellation: vscode.Disposable | false = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | false = false;
    try {
      onLoadingPhase?.('copilot');
      requestTokenSource = new vscode.CancellationTokenSource();
      requestCancellation = token.onCancellationRequested(() => {
        if (requestTokenSource !== false) {
          requestTokenSource.cancel();
        }
      });
      timeoutHandle = setTimeout(() => {
        if (requestTokenSource !== false) {
          requestTokenSource.cancel();
        }
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
      if (timeoutHandle !== false) {
        clearTimeout(timeoutHandle);
      }
      if (requestCancellation !== false) {
        requestCancellation.dispose();
      }
      if (requestTokenSource !== false) {
        requestTokenSource.dispose();
      }
    }
  } catch (error) {
    if (token.isCancellationRequested) {
      throw error;
    }
    return mapCopilotCompletionError(error, policy);
  }
}
