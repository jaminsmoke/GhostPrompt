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
import { listModels, generate } from "./ollamaApiClient";

function describeOllamaModel(modelName: string): SuggestionModelDescriptor {
  return {
    id: modelName,
    label: modelName,
    tier: "included",
    provider: "ollama",
  };
}

async function resolveOllamaModel(
  preferredModelId: string | undefined,
): Promise<string | undefined> {
  if (preferredModelId && preferredModelId !== "auto") {
    return preferredModelId;
  }

  const cfg = vscode.workspace.getConfiguration("ghostPrompt");
  const baseUrl = cfg.get<string>("ollamaBaseUrl", "http://localhost:11434");
  const excluded = new Set(cfg.get<string[]>("ollamaExcludedModelIds", []));
  try {
    const models = await listModels({ baseUrl });
    const available = models
      .map((m) => m.name)
      .filter((name) => !excluded.has(name));
    return available.length > 0 ? available[0] : undefined;
  } catch {
    return undefined;
  }
}

export async function requestOllamaCompletion(
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

  onLoadingPhase?.("ollama-start");

  const modelName = await resolveOllamaModel(preferredModelId);
  if (!modelName) {
    return { kind: "empty", reason: "no-model" };
  }

  const baseUrl = vscode.workspace.getConfiguration("ghostPrompt").get<string>("ollamaBaseUrl", "http://localhost:11434");
  const instruction = buildCompletionInstruction(userText, style, context);

  onLoadingPhase?.("ollama-loading");

  onLoadingPhase?.("ollama-generating");

  try {
    const completionText = await generate(instruction, modelName, {
      baseUrl,
      requestTimeoutMs,
      signal: token.isCancellationRequested ? undefined : undefined,
      onStreamPreview: onStreamPreview
        ? (text: string) => onStreamPreview(text)
        : undefined,
    });

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
      model: describeOllamaModel(modelName),
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
      return { kind: "empty", reason: "no-model" };
    }
    return { kind: "error", message };
  }
}
