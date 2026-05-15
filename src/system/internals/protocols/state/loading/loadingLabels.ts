/**
 * @file Textos de UI para fases de carga de sugerencias (contrato de presentación).
 */
import type { SuggestionLoadingPhase } from './loadingPhase';

/**
 * Convierte la fase de carga en texto de estado para la UI.
 * @param {SuggestionLoadingPhase} phase Fase actual de la solicitud de sugerencia.
 * @returns {string} Texto localizado que describe el estado de carga.
 */
export function suggestionLoadingStatusText(phase: SuggestionLoadingPhase): string {
  switch (phase) {
    case 'copilot':
      return 'Buscando modelo…';
    case 'copilot-generating':
      return 'Generando sugerencia…';
    case 'opencode-start':
      return 'Iniciando OpenCode…';
    case 'opencode-connecting':
      return 'Conectando con el servidor…';
    case 'opencode-generating':
      return 'Generando sugerencia…';
    case 'ollama-start':
      return 'Iniciando Ollama…';
    case 'ollama-loading':
      return 'Cargando modelo local…';
    case 'ollama-generating':
      return 'Generando sugerencia…';
    case 'ollama-checking-install':
      return 'Verificando instalación de Ollama…';
    case 'ollama-listing-models':
      return 'Obteniendo modelos locales…';
    case 'ollama-starting-model':
      return 'Iniciando modelo…';
    case 'ollama-model-ready':
      return 'Modelo listo';
  }
}
