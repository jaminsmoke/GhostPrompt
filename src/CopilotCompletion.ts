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
export type SuggestionModelTier = "free" | "premium";

export interface SuggestionModelDescriptor {
  id: string;
  label: string;
  tier: SuggestionModelTier;
}

type LanguageConfidence = "low" | "medium" | "high";
const LANGUAGE_DETECTION_MIN_CHARS = 12;

export type CompletionResult =
  | {
      kind: "suggestion";
      suggestion: string;
      model?: SuggestionModelDescriptor;
    }
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
  preferredModelId?: string;
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
    preferredModelId,
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

  const model = selectModelByPolicy(models, policy, preferredModelId);
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
    return { kind: "suggestion", suggestion, model: describeModel(model) };
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
  return detectLanguageSignal(input).language;
}

function detectLanguageSignal(input: string): {
  language: SupportedSuggestionLanguage;
  confidence: LanguageConfidence;
} {
  const normalized = input
    .toLowerCase()
    .replace(/[`*_~>#()[\]{}\\/|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return { language: "en", confidence: "low" };
  }

  if (/[ñáéíóúü¿¡]/u.test(normalized)) {
    return { language: "es", confidence: "high" };
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

  const language: SupportedSuggestionLanguage =
    spanishHits >= englishHits ? "es" : "en";
  const bestHits = Math.max(spanishHits, englishHits);
  const diff = Math.abs(spanishHits - englishHits);
  const confidence: LanguageConfidence =
    normalized.length < LANGUAGE_DETECTION_MIN_CHARS || bestHits === 0
      ? "low"
      : diff >= 2 && bestHits >= 2
        ? "high"
        : diff >= 1
          ? "medium"
          : "low";
  return { language, confidence };
}

export function resolveSuggestionLanguage(
  mode: SuggestionLanguageMode,
  manualLanguage: SupportedSuggestionLanguage,
  input: string,
  previousEffectiveLanguage?: SupportedSuggestionLanguage,
): SupportedSuggestionLanguage {
  if (mode === "manual") {
    return manualLanguage;
  }
  const signal = detectLanguageSignal(input);
  if (signal.confidence === "high") {
    return signal.language;
  }
  if (signal.confidence === "medium") {
    return signal.language;
  }
  return previousEffectiveLanguage ?? manualLanguage;
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

  if (shouldInsertSpaceAfterPunctuation(userText, normalized)) {
    normalized = ` ${normalized}`;
  }

  if (normalized.length > maxChars) {
    normalized = normalized.slice(0, maxChars).trimEnd();
  }

  return normalized;
}

function shouldInsertSpaceAfterPunctuation(
  userText: string,
  suggestion: string,
): boolean {
  if (!suggestion) {
    return false;
  }
  const first = suggestion[0];
  if (/\s/.test(first)) {
    return false;
  }
  if (!/[\p{L}\p{N}_]/u.test(first)) {
    return false;
  }
  if (/\s$/.test(userText)) {
    return false;
  }
  const last = getLastNonWhitespaceChar(userText);
  if (!last) {
    return false;
  }
  return /[:;,.!?]/.test(last);
}

function getLastNonWhitespaceChar(text: string): string {
  const trimmed = text.replace(/\s+$/g, "");
  if (!trimmed) {
    return "";
  }
  return trimmed[trimmed.length - 1];
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
  preferredModelId?: string,
): vscode.LanguageModelChat | undefined {
  if (preferredModelId) {
    const preferred = models.find(
      (candidate) => getModelId(candidate) === preferredModelId,
    );
    if (preferred) {
      if (policy === "anyModel" || isNonPremiumModel(preferred)) {
        return preferred;
      }
    }
  }

  if (policy === "anyModel") {
    return models[0];
  }
  return models.find((candidate) => isNonPremiumModel(candidate));
}

export async function listSuggestionModels(
  policy: SuggestionModelPolicy,
): Promise<SuggestionModelDescriptor[]> {
  const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
  const filtered =
    policy === "anyModel"
      ? models
      : models.filter((candidate) => isNonPremiumModel(candidate));
  const seen = new Set<string>();
  const descriptors: SuggestionModelDescriptor[] = [];
  for (const candidate of filtered) {
    const descriptor = describeModel(candidate);
    if (seen.has(descriptor.id)) {
      continue;
    }
    seen.add(descriptor.id);
    descriptors.push(descriptor);
  }
  return descriptors;
}

function describeModel(model: unknown): SuggestionModelDescriptor {
  const data = model as { id?: string; family?: string; name?: string };
  const id = getModelId(model);
  const label = data.name?.trim() || data.family?.trim() || id;
  return {
    id,
    label,
    tier: isNonPremiumModel(model) ? "free" : "premium",
  };
}

function getModelId(model: unknown): string {
  const data = model as { id?: string; family?: string; name?: string };
  return data.id?.trim() || data.family?.trim() || data.name?.trim() || "unknown";
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
