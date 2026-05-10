/**
 * Fases de UI durante una solicitud de suggestion (host ↔ webview).
 * Textos en español para paridad con el resto de la barra de estado del webview.
 */

export type SuggestionLoadingPhase =
  | "copilot"
  | "opencode-start"
  | "opencode-connecting"
  | "opencode-generating";

export function suggestionLoadingStatusText(
  phase: SuggestionLoadingPhase,
): string {
  switch (phase) {
    case "copilot":
      return "Buscando sugerencia…";
    case "opencode-start":
      return "Iniciando OpenCode…";
    case "opencode-connecting":
      return "Conectando con el servidor…";
    case "opencode-generating":
      return "Generando sugerencia…";
  }
}
