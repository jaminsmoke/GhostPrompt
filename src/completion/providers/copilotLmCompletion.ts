/**
 * Proveedor de completions vía GitHub Copilot Language Model API (`vscode.lm`).
 */
import * as vscode from "vscode";

import { buildCompletionInstruction } from "../instruction";
import { describeModel, selectModelByPolicy } from "../catalog/modelCatalog";
import { normalizeSuggestion } from "../normalize";
import { collectResponseText } from "../streaming";
import {
  DEFAULT_MAX_SUGGESTION_CHARS,
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
  type CompletionRequestOptions,
  type CompletionResult,
} from "../types";

let premiumQuotaBlocked = false;

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
    const requestTokenSource = new vscode.CancellationTokenSource();
    const requestCancellation = token.onCancellationRequested(() => {
      requestTokenSource.cancel();
    });
    const timeoutHandle = setTimeout(() => {
      requestTokenSource.cancel();
    }, requestTimeoutMs);

    const instruction = buildCompletionInstruction(userText, style, context);
    try {
      onLoadingPhase?.("copilot");
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
      requestCancellation.dispose();
      requestTokenSource.dispose();
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

function isPremiumQuotaError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("premium model quota") ||
    normalized.includes("additional paid premium requests") ||
    normalized.includes("allowance to renew")
  );
}
