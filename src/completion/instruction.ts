import type { SuggestionContext, SuggestionStyle } from "./types";

/**
 * Fragmento de instrucción por estilo de suggestion (GhostPrompt).
 * Incluye prefijos `STYLE_*` estables para tests de regresión.
 */
export function suggestionStyleDirective(style: SuggestionStyle): string {
  switch (style) {
    case "concise":
      return (
        "STYLE_CONCISE: Continue with at most 4 words total — essentials only, no comma-separated list, " +
        "no second sentence, no filler."
      );
    case "detailed":
      return (
        "STYLE_DETAILED: Continue with 2-3 fluent sentences and concrete specifics " +
        "(aim for roughly 25-60 words total when the idea warrants it)."
      );
    default:
      return (
        "STYLE_BALANCED: Continue with exactly one practical sentence (roughly 8-18 words) " +
        "that advances the same intent as the partial prompt."
      );
  }
}

function truncateInline(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 3))}...`;
}

export function buildCompletionInstruction(
  userText: string,
  style: SuggestionStyle = "balanced",
  context?: SuggestionContext,
): string {
  const styleDirective = suggestionStyleDirective(style);
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
  if (context?.projectBootstrapLines?.length) {
    for (const raw of context.projectBootstrapLines) {
      const row = raw.trim();
      if (row) {
        projectContext.push(truncateInline(row, 1550));
      }
    }
  }

  return (
    "You are a prompt completion assistant. " +
    "The user is typing a prompt for GitHub Copilot Chat. " +
    "Predict and return ONLY the natural continuation of the following partial text. " +
    styleDirective +
    " " +
    languageDirective +
    "Never repeat what was already written. " +
    "If your continuation starts a new word and the partial text does not end with whitespace, include exactly one leading space. " +
    "If you are completing the current unfinished word, do not add a leading space. " +
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
