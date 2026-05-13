import type { CompletionRequestOptions, CompletionResult } from "../completion/types";
import { getEnabledCompletionSources } from "../completion/completionSources";

import { requestCopilotLmCompletion } from "./copilot/copilotLmEngine";
import { requestOpencodeCompletion } from "./opencode/opencodeLmEngine";

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

export function getCompletionProviderForSource(
  source: "copilot" | "opencode",
): CompletionProvider {
  return source === "opencode" ? opencodeProvider : copilotLmProvider;
}

export function getActiveCompletionProvider(): CompletionProvider {
  const sources = getEnabledCompletionSources();
  const source = sources.length === 1 ? sources[0] : "copilot";
  return getCompletionProviderForSource(source);
}

export function getCompletionProviderKind(): "copilot" | "opencode" {
  const s = getEnabledCompletionSources();
  if (s.length === 1) {
    return s[0];
  }
  return "copilot";
}
