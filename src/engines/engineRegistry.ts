import type { CompletionRequestOptions, CompletionResult } from '../core/types';
import { getEnabledCompletionSources } from '../core/sources';

import { requestCopilotLmCompletion } from "./copilot/copilotLmEngine";
import { requestOpencodeCompletion } from "./opencode/opencodeLmEngine";
import { requestOllamaCompletion } from "./ollama/ollamaLmEngine";

export interface CompletionProvider {
  readonly id: string;
  requestCompletion(
    userText: string,
    options: CompletionRequestOptions,
  ): Promise<CompletionResult>;
}

const copilotLmProvider: CompletionProvider = {
  id: "copilotLm",
  requestCompletion: requestCopilotLmCompletion,
};

const opencodeProvider: CompletionProvider = {
  id: "opencode",
  requestCompletion: requestOpencodeCompletion,
};

const ollamaProvider: CompletionProvider = {
  id: "ollama",
  requestCompletion: requestOllamaCompletion,
};

export function getCompletionProviderForSource(
  source: "copilot" | "opencode" | "ollama",
): CompletionProvider {
  if (source === "opencode") return opencodeProvider;
  if (source === "ollama") return ollamaProvider;
  return copilotLmProvider;
}

export function getActiveCompletionProvider(): CompletionProvider {
  const sources = getEnabledCompletionSources();
  const source = sources.length === 1 ? sources[0] : "copilot";
  return getCompletionProviderForSource(source);
}

export function getCompletionProviderKind(): "copilot" | "opencode" | "ollama" {
  const s = getEnabledCompletionSources();
  if (s.length === 1) {
    return s[0];
  }
  return "copilot";
}
