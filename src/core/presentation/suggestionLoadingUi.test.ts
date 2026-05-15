import { describe, it, expect } from 'vitest';
import {
  suggestionLoadingStatusText,
  type SuggestionLoadingPhase,
} from './loading';

describe('suggestionLoadingStatusText', () => {
  const cases: Array<[SuggestionLoadingPhase, string]> = [
    ['copilot', 'Buscando modelo…'],
    ['copilot-generating', 'Generando sugerencia…'],
    ['opencode-start', 'Iniciando OpenCode…'],
    ['opencode-connecting', 'Conectando con el servidor…'],
    ['opencode-generating', 'Generando sugerencia…'],
    ['ollama-start', 'Iniciando Ollama…'],
    ['ollama-loading', 'Cargando modelo local…'],
    ['ollama-generating', 'Generando sugerencia…'],
    ['ollama-checking-install', 'Verificando instalación de Ollama…'],
    ['ollama-listing-models', 'Obteniendo modelos locales…'],
    ['ollama-starting-model', 'Iniciando modelo…'],
    ['ollama-model-ready', 'Modelo listo'],
  ];

  it.each(cases)('maps %s', (phase, expected) => {
    expect(suggestionLoadingStatusText(phase)).toBe(expected);
  });
});
