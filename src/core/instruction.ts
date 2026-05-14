import { detectSuggestionLanguageFromInput } from "./language";
import type { SuggestionContext, SuggestionStyle, SupportedSuggestionLanguage } from "./types";

/**
 * Prefix used for the partial completion chunk sent to Copilot as a second user message.
 */
export const COMPLETION_PARTIAL_LABEL = "Partial text to continue: ";

/**
 * Devuelve la directiva de estilo adecuada para el prompt del modelo.
 * @param style Estilo de sugerencia deseado.
 * @returns Instrucción de estilo para el prompt.
 */
export function suggestionStyleDirective(style: SuggestionStyle): string {
  switch (style) {
    case "concise":
      return "STYLE_CONCISE: Write a concise continuation in 4 words or fewer.";
    case "detailed":
      return "STYLE_DETAILED: Write 2-3 fluent sentences totaling 25-60 words.";
    case "balanced":
    default:
      return "STYLE_BALANCED: Write one practical sentence in 8-18 words.";
  }
}

/**
 * Resuelve el idioma de salida para la sugerencia.
 * @param context Contexto de sugerencia opcional.
 * @returns El idioma resuelto para el prompt.
 */
function resolveOutputLanguage(context?: SuggestionContext): SupportedSuggestionLanguage {
  if (context?.outputLanguage) {
    return context.outputLanguage;
  }
  if (context?.lastSentPrompt) {
    return detectSuggestionLanguageFromInput(context.lastSentPrompt);
  }
  return "en";
}

/**
 * Construye la sección de contexto de proyecto para el prompt.
 * @param context Contexto de sugerencia con información de workspace y archivo.
 * @returns El texto de contexto de proyecto o una cadena vacía.
 */
function buildProjectContext(context: SuggestionContext): string {
  const lines: string[] = [];
  if (context.workspaceName) {
    lines.push(`Workspace: ${context.workspaceName}`);
  }
  if (context.activeFilePath) {
    lines.push(`Active file: ${context.activeFilePath}`);
  }
  if (context.activeLanguageId) {
    lines.push(`Active language: ${context.activeLanguageId}`);
  }
  if (context.projectBootstrapLines?.length) {
    lines.push(...context.projectBootstrapLines);
  }
  if (lines.length === 0) {
    return "";
  }

  return [`Relevant project context:`, ...lines].join("\n");
}

/**
 * Divide la instrucción completa en el prefijo del prompt y el texto parcial etiquetado.
 * @param userText Texto que se quiere continuar.
 * @param style Estilo de sugerencia deseado.
 * @param context Contexto adicional para el prompt.
 * @returns Un objeto con el prompt prefijo y el texto parcial etiquetado.
 */
export function buildCompletionInstructionParts(
  userText: string,
  style: SuggestionStyle = "balanced",
  context?: SuggestionContext,
): { prefixInstruction: string; labeledPartial: string } {
  const outputLanguage = resolveOutputLanguage(context);
  const prefixLines: string[] = [suggestionStyleDirective(style)];

  if (context?.lastSentPrompt) {
    prefixLines.push(`Recent prompt sent by user: ${context.lastSentPrompt}`);
  }
  if (context?.lastAcceptedSuggestion) {
    prefixLines.push(`Recent accepted suggestion style: ${context.lastAcceptedSuggestion}`);
  }
  if (context?.recentSentPrompts?.length) {
    prefixLines.push("Recent prompts (latest first):");
    prefixLines.push(...context.recentSentPrompts);
  }

  const projectContext = context ? buildProjectContext(context) : "";
  if (projectContext) {
    prefixLines.push(projectContext);
  }

  prefixLines.push(
    `Write the continuation in ${outputLanguage === "es" ? "Spanish" : "English"}.`,
    "If your continuation starts a new word and the partial text does not end with whitespace, include exactly one leading space.",
    "If you are completing the current unfinished word, do not add a leading space.",
    "Do not translate code identifiers.",
    "Do not repeat the prompt text before the partial text.",
  );

  const prefixInstruction = prefixLines.join("\n") + "\n";
  const labeledPartial = `${COMPLETION_PARTIAL_LABEL}${userText}`;

  return {
    prefixInstruction,
    labeledPartial,
  };
}

/**
 * Construye la instrucción completa para el LM a partir del texto del usuario, estilo y contexto.
 * @param userText Texto que se debe continuar.
 * @param style Estilo de sugerencia deseado.
 * @param context Contexto adicional para guiar la generación.
 * @returns Prompt completo listo para enviar al modelo.
 */
export function buildCompletionInstruction(
  userText: string,
  style: SuggestionStyle = "balanced",
  context?: SuggestionContext,
): string {
  const { prefixInstruction, labeledPartial } = buildCompletionInstructionParts(
    userText,
    style,
    context,
  );
  return prefixInstruction + labeledPartial;
}
