/**
 * @file Fases de UI de carga usadas por las sugerencias (contrato).
 */
export type SuggestionLoadingPhase =
  | 'copilot'
  | 'copilot-generating'
  | 'opencode-start'
  | 'opencode-connecting'
  | 'opencode-generating'
  | 'ollama-start'
  | 'ollama-loading'
  | 'ollama-generating'
  | 'ollama-checking-install'
  | 'ollama-listing-models'
  | 'ollama-starting-model'
  | 'ollama-model-ready';
