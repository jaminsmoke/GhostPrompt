/**
 * @file Fases de UI de carga usadas por las sugerencias (contrato).
 */
export type SuggestionLoadingPhase =
  'copilot-generating' | 'copilot' | 'ollama-checking-install' | 'ollama-generating' | 'ollama-listing-models' | 'ollama-loading' | 'ollama-model-ready' | 'ollama-start' | 'ollama-starting-model' | 'opencode-connecting' | 'opencode-generating' | 'opencode-start';
