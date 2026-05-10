import * as vscode from "vscode";

import type { CompletionRequestOptions, CompletionResult } from "./types";
import { getEnabledCompletionSources } from "./completionSources";

import { requestCopilotLmCompletion } from "./providers/copilotLmCompletion";
import { requestOpencodeCompletion } from "./providers/opencodeLmCompletion";

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

const opencodeProvider: CompletionProvider = {
  id: "opencode",
  requestCompletion: requestOpencodeCompletion,
};

/**
 * Devuelve el adaptador del motor indicado (enrutado en multi‑fuente).
 */
export function getCompletionProviderForSource(
  source: "copilot" | "opencode",
): CompletionProvider {
  return source === "opencode" ? opencodeProvider : copilotLmProvider;
}

/**
 * Primer motor habilitado (solo sentido con una sola fuente; con varias, Copilot).
 * Preferir `getCompletionProviderForSource` + `resolveCompletionSourceForRequest`.
 */
export function getActiveCompletionProvider(): CompletionProvider {
  const sources = getEnabledCompletionSources();
  const source = sources.length === 1 ? sources[0] : "copilot";
  return getCompletionProviderForSource(source);
}

/**
 * Compat webview: con **una** fuente devuelve esa; con **varias** devuelve `copilot`
 * (el UI usa `completionUiKind` = `multi`).
 */
export function getCompletionProviderKind(): "copilot" | "opencode" {
  const s = getEnabledCompletionSources();
  if (s.length === 1) {
    return s[0];
  }
  return "copilot";
}
