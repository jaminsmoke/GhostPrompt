/**
 * @file Tests del texto de carga de sugerencias.
 */

import * as vitest from 'vitest';

import { suggestionLoadingStatusText } from './stateLoadingLabels';

import type { SuggestionLoadingPhase } from './stateLoadingPhase';

vitest.describe('suggestionLoadingStatusText', () => {
  const cases: [SuggestionLoadingPhase, string][] = [
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

  for (const [phase, expected] of cases) {
    vitest.it(`returns "${expected}" for phase "${phase}"`, () => {
      vitest.expect(suggestionLoadingStatusText(phase)).toBe(expected);
    });
  }
});
