import * as vscode from "vscode";

import { buildCompletionInstruction } from '../../core/instruction';
import { describeModel, selectModelByPolicy } from "./catalog/modelCatalog";
import { normalizeSuggestion } from '../../core/normalize';
import { collectResponseText } from '../../core/streaming';
import {
  DEFAULT_MAX_SUGGESTION_CHARS,
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
  type CompletionRequestOptions,
  type CompletionResult,
} from '../../core/types';

let premiumQuotaBlocked = false;

/**
 * Solicita una sugerencia a Copilot LM y normaliza el resultado para GhostPrompt.
 * @param userText Texto de usuario actual que debe completarse.
 * @param options Configuración de la petición, incluyendo modelo, timeout y contexto.
 * @returns Resultado de la petición de completado, con sugerencia o razón vacía.
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
    style = "balanced",
    context,
    requestTimeoutMs = DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
    onLoadingPhase,
  } = options;
  if (policy === "nonPremiumOnly" && premiumQuotaBlocked) {
    return { kind: "empty", reason: "premium-quota-blocked" };
  }

  const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
  if (!models.length) {
    return { kind: "empty", reason: "no-model" };
  }

  const model = selectModelByPolicy(models, policy, preferredModelId);
  if (!model) {
    return { kind: "empty", reason: "no-included-model" };
  }

  try {
    const instruction = buildCompletionInstruction(userText, style, context);
    let requestTokenSource: vscode.CancellationTokenSource | undefined;
    let requestCancellation: vscode.Disposable | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      onLoadingPhase?.("copilot");
      requestTokenSource = new vscode.CancellationTokenSource();
      requestCancellation = token.onCancellationRequested(() => {
        requestTokenSource!.cancel();
      });
      timeoutHandle = setTimeout(() => {
        requestTokenSource!.cancel();
      }, requestTimeoutMs);
      onLoadingPhase?.("copilot-generating");
      const response = await model.sendRequest(
        [vscode.LanguageModelChatMessage.User(instruction)],
        {},
        requestTokenSource.token,
      );

      const completion = await collectResponseText(response, requestTimeoutMs);
      const suggestion = normalizeSuggestion(
        completion,
        userText,
        maxSuggestionChars,
      );
      if (!suggestion) {
        return { kind: "empty", reason: "empty-response" };
      }
      return { kind: "suggestion", suggestion, model: describeModel(model) };
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
      return { kind: "empty", reason: "request-timeout" };
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    if (policy === "nonPremiumOnly" && isPremiumQuotaError(message)) {
      premiumQuotaBlocked = true;
      return { kind: "empty", reason: "premium-quota-blocked" };
    }
    return { kind: "error", message };
  }
}

/**
 * Detecta si el mensaje de error coincide con el bloqueo de cuota premium de Copilot.
 * @param message Mensaje devuelto por la API de Copilot.
 * @returns True cuando el error indica que se alcanzó cuota premium.
 */
function isPremiumQuotaError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("premium model quota") ||
    normalized.includes("additional paid premium requests") ||
    normalized.includes("allowance to renew")
  );
}
