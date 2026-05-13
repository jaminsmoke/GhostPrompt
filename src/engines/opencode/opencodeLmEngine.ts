import * as vscode from "vscode";

import { buildCompletionInstruction } from '../../core/instruction';
import { normalizeSuggestion } from '../../core/normalize';
import {
  DEFAULT_MAX_SUGGESTION_CHARS,
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
  type CompletionRequestOptions,
  type CompletionResult,
  type SuggestionModelDescriptor,
} from '../../core/types';
import {
  createOpenCodeClient,
  getGlobalClient,
  healthCheck,
  promptOpenCode,
  resetClient,
  getSession,
} from "./opencodeApiClient";

function describeOpenCodeModel(modelId: string): SuggestionModelDescriptor {
  return {
    id: modelId,
    label: modelId,
    tier: "included",
    provider: "opencode",
  };
}

async function resolveOpenCodeModel(
  preferredModelId: string | undefined,
): Promise<string | undefined> {
  if (preferredModelId && preferredModelId !== "auto") {
    return preferredModelId;
  }
  return undefined;
}

async function ensureClient(): Promise<boolean> {
  const cfg = vscode.workspace.getConfiguration("ghostPrompt");
  const port = cfg.get<number>("opencodePort");
  const authToken = cfg.get<string>("opencodeAuthToken");

  try {
    const client = await createOpenCodeClient({
      port,
      authToken,
    });
    return await healthCheck(client);
  } catch {
    return false;
  }
}

export async function requestOpencodeCompletion(
  userText: string,
  options: CompletionRequestOptions,
): Promise<CompletionResult> {
  const {
    token,
    preferredModelId,
    maxSuggestionChars = DEFAULT_MAX_SUGGESTION_CHARS,
    style = "balanced",
    context,
    requestTimeoutMs = DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
    onLoadingPhase,
    onStreamPreview,
  } = options;

  onLoadingPhase?.("opencode-connecting");

  const alive = await ensureClient();
  if (!alive) {
    return { kind: "empty", reason: "no-model" };
  }

  const modelName = await resolveOpenCodeModel(preferredModelId);
  if (!modelName) {
    return { kind: "empty", reason: "no-model" };
  }

  const client = getGlobalClient();
  const instruction = buildCompletionInstruction(userText, style, context);

  onLoadingPhase?.("opencode-generating");

  try {
    const sessionId = await getSession(client);

    const completionText = await promptOpenCode(
      sessionId,
      { providerID: "opencode", modelID: modelName },
      [{ type: "text", text: instruction }],
      client,
    );

    if (token.isCancellationRequested) {
      return { kind: "empty", reason: "request-timeout" };
    }

    const suggestion = normalizeSuggestion(
      completionText,
      userText,
      maxSuggestionChars,
    );

    if (!suggestion) {
      return { kind: "empty", reason: "empty-response" };
    }

    return {
      kind: "suggestion",
      suggestion,
      model: describeOpenCodeModel(modelName),
    };
  } catch (err) {
    if (token.isCancellationRequested) {
      return { kind: "empty", reason: "request-timeout" };
    }
    const message = err instanceof Error ? err.message : String(err);
    if (/timed out|cancelled/i.test(message)) {
      return { kind: "empty", reason: "request-timeout" };
    }
    if (/ECONNREFUSED|fetch failed|not found|no model/i.test(message)) {
      resetClient();
      return { kind: "empty", reason: "no-model" };
    }
    resetClient();
    return { kind: "error", message };
  }
}