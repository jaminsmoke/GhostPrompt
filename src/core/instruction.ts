import type { SuggestionContext, SuggestionStyle } from "./types";

/**
 * Prefix used for the partial completion chunk sent to the model.
 */
export const COMPLETION_PARTIAL_LABEL = "Partial text to continue: ";

/**
 * Devuelve la directiva de estilo adecuada para el prompt del modelo.
 * @param {SuggestionStyle} style Estilo de sugerencia deseado.
 * @returns {string} Instrucción de estilo para el prompt.
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
 * Construye la instrucción completa para el modelo a partir del texto del usuario.
 * El contexto adicional se ignora para mantener el prompt lo más simple posible.
 * @param {string} userText Texto que se debe continuar.
 * @param {SuggestionStyle} style Estilo de sugerencia deseado.
 * @param {SuggestionContext | undefined} _context Contexto adicional que se ignora por ahora.
 * @returns {string} Prompt completo listo para enviar al modelo.
 */
export function buildCompletionInstruction(
  userText: string,
  style: SuggestionStyle = "balanced",
  _context?: SuggestionContext,
): string {
  const prefixLines: string[] = [suggestionStyleDirective(style)];
  prefixLines.push(
    "You are an autocomplete assistant. Complete the partial text as a natural continuation.",
    "Do not add extra commentary, explanations, or anything beyond the suggested completion.",
    "If the partial text does not end with whitespace and the continuation starts a new word, include exactly one leading space.",
    "If you are continuing the current unfinished word, do not add a leading space.",
    "Do not repeat the prompt text before the partial text.",
  );

  const prefixInstruction = prefixLines.join("\n") + "\n";
  const labeledPartial = `${COMPLETION_PARTIAL_LABEL}${userText}`;
  return prefixInstruction + labeledPartial;
}
