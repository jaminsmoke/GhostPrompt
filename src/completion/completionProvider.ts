import type { CompletionRequestOptions, CompletionResult } from "./types";

import { requestCopilotLmCompletion } from "./providers/copilotLmCompletion";

/**
 * Contrato para cualquier motor de suggestions (Copilot LM, OpenCode, etc.).
 */
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

/**
 * Proveedor activo. En el futuro puede leer `ghostPrompt.completionProvider` u otra setting.
 */
export function getActiveCompletionProvider(): CompletionProvider {
  return copilotLmProvider;
}
