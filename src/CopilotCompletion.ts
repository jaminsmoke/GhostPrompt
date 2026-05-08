/**
 * @fileoverview Solicita completions al modelo de lenguaje de Copilot
 * usando la API `vscode.lm` — sin abrir ningún editor ni robar el foco.
 *
 * Sustituye al ciclo draft.md + inlineSuggest que era la causa de:
 *   - draft.md visible como pestaña del editor.
 *   - Pérdida de foco del webview al abrir el documento de borrador.
 */
import * as vscode from "vscode";

export type SuggestionModelPolicy = "nonPremiumOnly" | "anyModel";
export type SuggestionStyle = "concise" | "balanced" | "detailed";
export type SuggestionLanguageMode = "auto" | "manual";
export type SupportedSuggestionLanguage = "es" | "en";

export type CompletionResult =
  | { kind: "suggestion"; suggestion: string }
  | {
      kind: "empty";
      reason:
        | "no-model"
        | "no-non-premium-model"
        | "premium-quota-blocked"
        | "empty-response"
        | "too-short"
        | "duplicate-input"
        | "rate-limited"
        | "session-budget-exhausted";
    }
  | { kind: "error"; message: string };

let premiumQuotaBlocked = false;
const DEFAULT_MAX_SUGGESTION_CHARS = 180;

export interface CompletionRequestOptions {
  token: vscode.CancellationToken;
  policy: SuggestionModelPolicy;
  maxSuggestionChars?: number;
  style?: SuggestionStyle;
  context?: SuggestionContext;
}

export interface SuggestionContext {
  lastAcceptedSuggestion?: string;
  lastSentPrompt?: string;
  recentSentPrompts?: string[];
  workspaceName?: string;
  activeFilePath?: string;
  activeLanguageId?: string;
  activeSelection?: string;
  outputLanguage?: SupportedSuggestionLanguage;
}

/**
 * Solicita al modelo Copilot una continuación corta del texto parcial del usuario.
 *
 * @param userText - Texto que el usuario está escribiendo en el mini-input.
 * @param token - Token de cancelación para abortar requests previas.
 * @returns Resultado tipado para que la webview no quede en silencio.
 */
export async function requestCompletion(
  userText: string,
  options: CompletionRequestOptions,
): Promise<CompletionResult> {
  const {
    token,
    policy,
    maxSuggestionChars = DEFAULT_MAX_SUGGESTION_CHARS,
    style = "balanced",
    context,
  } = options;
  if (policy === "nonPremiumOnly" && premiumQuotaBlocked) {
    return { kind: "empty", reason: "premium-quota-blocked" };
  }

  const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
  if (!models.length) {
    return { kind: "empty", reason: "no-model" };
  }

  const model = selectModelByPolicy(models, policy);
  if (!model) {
    return { kind: "empty", reason: "no-non-premium-model" };
  }

  try {
    const instruction = buildCompletionInstruction(userText, style, context);

    const response = await model.sendRequest(
      [vscode.LanguageModelChatMessage.User(instruction)],
      {},
      token,
    );

    const completion = await collectResponseText(response);
    const suggestion = normalizeSuggestion(
      completion,
      userText,
      maxSuggestionChars,
    );
    if (!suggestion) {
      return { kind: "empty", reason: "empty-response" };
    }
    return { kind: "suggestion", suggestion };
  } catch (error) {
    if (token.isCancellationRequested) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    if (policy === "nonPremiumOnly" && isPremiumQuotaError(message)) {
      premiumQuotaBlocked = true;
      return { kind: "empty", reason: "premium-quota-blocked" };
    }
    return { kind: "error", message };
  }
}

export function buildCompletionInstruction(
  userText: string,
  style: SuggestionStyle = "balanced",
  context?: SuggestionContext,
): string {
  const styleDirective =
    style === "concise"
      ? "Keep the completion short and practical (1 sentence)."
      : style === "detailed"
        ? "Provide a richer continuation with concrete details (1-3 sentences when useful)."
        : "Provide a balanced continuation with specific intent and moderate detail (1-2 sentences).";
  const outputLanguage = context?.outputLanguage ?? "en";
  const languageDirective =
    outputLanguage === "es"
      ? "Write the continuation in Spanish. "
      : "Write the continuation in English. ";

  const recentContext: string[] = [];
  if (context?.lastSentPrompt?.trim()) {
    recentContext.push(`Recent prompt sent by user: ${context.lastSentPrompt}`);
  }
  if (context?.lastAcceptedSuggestion?.trim()) {
    recentContext.push(
      `Recent accepted suggestion style: ${context.lastAcceptedSuggestion}`,
    );
  }
  if (context?.recentSentPrompts?.length) {
    const lines = context.recentSentPrompts
      .map((prompt) => truncateInline(prompt, 220))
      .filter(Boolean);
    if (lines.length) {
      recentContext.push(`Recent prompts (latest first): ${lines.join(" | ")}`);
    }
  }

  const projectContext: string[] = [];
  if (context?.workspaceName?.trim()) {
    projectContext.push(`Workspace: ${truncateInline(context.workspaceName, 80)}`);
  }
  if (context?.activeFilePath?.trim()) {
    projectContext.push(`Active file: ${truncateInline(context.activeFilePath, 180)}`);
  }
  if (context?.activeLanguageId?.trim()) {
    projectContext.push(`Active language: ${truncateInline(context.activeLanguageId, 40)}`);
  }
  if (context?.activeSelection?.trim()) {
    projectContext.push(
      `Active selection excerpt: ${truncateInline(context.activeSelection, 320)}`,
    );
  }

  return (
    "You are a prompt completion assistant. " +
    "The user is typing a prompt for GitHub Copilot Chat. " +
    "Predict and return ONLY the natural continuation of the following partial text. " +
    styleDirective +
    languageDirective +
    "Never repeat what was already written. " +
    "Keep context and intent specific, avoiding generic filler. " +
    "Do not translate code identifiers, API names, file paths, or quoted text. " +
    "Do not add explanations, greetings, or any metadata.\n\n" +
    (projectContext.length
      ? `Relevant project context:\n- ${projectContext.join("\n- ")}\n\n`
      : "") +
    (recentContext.length
      ? `Relevant recent context:\n- ${recentContext.join("\n- ")}\n\n`
      : "") +
    "Partial text to continue: " +
    userText
  );
}

export function detectSuggestionLanguageFromInput(
  input: string,
): SupportedSuggestionLanguage {
  const normalized = input
    .toLowerCase()
    .replace(/[`*_~>#()[\]{}\\/|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "en";
  }

  if (/[ñáéíóúü¿¡]/u.test(normalized)) {
    return "es";
  }

  const spanishHits = countWordHits(normalized, [
    " de ",
    " la ",
    " el ",
    " en ",
    " que ",
    " para ",
    " con ",
    " una ",
    " un ",
    " por ",
    " como ",
    " quiero ",
    " necesito ",
    " y ",
  ]);
  const englishHits = countWordHits(normalized, [
    " the ",
    " and ",
    " with ",
    " for ",
    " in ",
    " to ",
    " of ",
    " i ",
    " want ",
    " need ",
    " create ",
    " build ",
  ]);

  return spanishHits >= englishHits ? "es" : "en";
}

export function resolveSuggestionLanguage(
  mode: SuggestionLanguageMode,
  manualLanguage: SupportedSuggestionLanguage,
  input: string,
): SupportedSuggestionLanguage {
  if (mode === "manual") {
    return manualLanguage;
  }
  return detectSuggestionLanguageFromInput(input);
}

function countWordHits(text: string, needles: string[]): number {
  const padded = ` ${text} `;
  return needles.reduce((hits, needle) => hits + (padded.includes(needle) ? 1 : 0), 0);
}

function truncateInline(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 3))}...`;
}

export async function collectResponseText(
  response: vscode.LanguageModelChatResponse,
): Promise<string> {
  let completion = "";
  for await (const chunk of response.text) {
    completion += chunk;
  }
  return completion;
}

export function normalizeSuggestion(
  rawSuggestion: string,
  userText: string,
  maxChars: number,
): string {
  let normalized = rawSuggestion.replace(/\r\n/g, "\n").trimEnd();
  const prefix = userText.trim();

  if (!normalized) {
    return "";
  }

  if (prefix && normalized.toLowerCase().startsWith(prefix.toLowerCase())) {
    normalized = normalized.slice(prefix.length);
    /* No trimStart: la continuación suele empezar con espacio o \n respecto a la última palabra. */
  } else if (prefix) {
    const overlap = findSuffixPrefixOverlap(prefix, normalized);
    if (overlap > 0) {
      normalized = normalized.slice(overlap);
    } else {
      const trailingWord = getTrailingWord(prefix);
      if (
        trailingWord.length >= 3 &&
        normalized.toLowerCase().startsWith(trailingWord.toLowerCase())
      ) {
        normalized = normalized.slice(trailingWord.length);
      }
    }
  }

  if (!normalized.trim()) {
    return "";
  }

  if (normalized.length > maxChars) {
    normalized = normalized.slice(0, maxChars).trimEnd();
  }

  return normalized;
}

function findSuffixPrefixOverlap(left: string, right: string): number {
  const leftLower = left.toLowerCase();
  const rightLower = right.toLowerCase();
  const max = Math.min(leftLower.length, rightLower.length, 80);
  for (let len = max; len >= 3; len -= 1) {
    if (leftLower.slice(-len) === rightLower.slice(0, len)) {
      return len;
    }
  }
  return 0;
}

function getTrailingWord(text: string): string {
  const match = text.match(/[\p{L}\p{N}_]+$/u);
  return match?.[0] ?? "";
}

export function selectModelByPolicy(
  models: readonly vscode.LanguageModelChat[],
  policy: SuggestionModelPolicy,
): vscode.LanguageModelChat | undefined {
  if (policy === "anyModel") {
    return models[0];
  }
  return models.find((candidate) => isNonPremiumModel(candidate));
}

function isNonPremiumModel(model: unknown): boolean {
  const data = model as { id?: string; family?: string; name?: string };
  const fingerprint = `${data.id ?? ""} ${data.family ?? ""} ${data.name ?? ""}`
    .toLowerCase()
    .trim();

  if (!fingerprint) {
    return false;
  }

  // Lista conservadora: permitimos solo variantes tipicamente "economicas".
  const allowMarkers = ["mini", "nano", "haiku", "flash"];
  const hasAllowMarker = allowMarkers.some((marker) =>
    fingerprint.includes(marker),
  );
  if (!hasAllowMarker) {
    return false;
  }

  const denyMarkers = [
    "premium",
    "pro",
    "opus",
    "sonnet",
    "gpt-5",
    "gpt-4.1",
    "o1",
    "o3",
    "o4",
  ];
  return !denyMarkers.some((marker) => fingerprint.includes(marker));
}

function isPremiumQuotaError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("premium model quota") ||
    normalized.includes("additional paid premium requests") ||
    normalized.includes("allowance to renew")
  );
}
