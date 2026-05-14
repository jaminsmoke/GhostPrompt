/**
 * Fases de UI durante una solicitud de suggestion (host ↔ webview).
 * Textos en español para paridad con el resto de la barra de estado del webview.
 */

export type SuggestionLoadingPhase =
  | "copilot"
  | "copilot-generating"
  | "opencode-start"
  | "opencode-connecting"
  | "opencode-generating"
  | "ollama-start"
  | "ollama-loading"
  | "ollama-generating"
  | "ollama-checking-install"
  | "ollama-listing-models"
  | "ollama-starting-model"
  | "ollama-model-ready";

export function suggestionLoadingStatusText(
  phase: SuggestionLoadingPhase,
): string {
  switch (phase) {
    case "copilot":
      return "Buscando modelo…";
    case "copilot-generating":
      return "Generando sugerencia…";
    case "opencode-start":
      return "Iniciando OpenCode…";
    case "opencode-connecting":
      return "Conectando con el servidor…";
    case "opencode-generating":
      return "Generando sugerencia…";
    case "ollama-start":
      return "Iniciando Ollama…";
    case "ollama-loading":
      return "Cargando modelo local…";
    case "ollama-generating":
      return "Generando sugerencia…";
    case "ollama-checking-install":
      return "Verificando instalación de Ollama…";
    case "ollama-listing-models":
      return "Obteniendo modelos locales…";
    case "ollama-starting-model":
      return "Iniciando modelo…";
    case "ollama-model-ready":
      return "Modelo listo";
  }
}
