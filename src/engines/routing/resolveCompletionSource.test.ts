/**
 * @file Tests de enrutamiento de fuentes de completado.
 */

import * as vitest from 'vitest';
import { vi } from 'vitest';

vi.mock('../provider/ollama/routing/routingModelId', () => ({
  looksLikeOllamaModelId: (id: string) => id.includes(':') && !id.includes('/'),
}));

vi.mock('../provider/opencode/routingModelId', () => ({
  looksLikeOpencodeModelId: (id: string) => {
    const t = id.trim();
    const slash = t.indexOf('/');
    if (slash <= 0 || slash === t.length - 1) {
      return false;
    }
    return !t.includes('//') && t.split('/').length === 2;
  },
}));

import { resolveCompletionSourceForRequest } from './resolveCompletionSource';

vitest.describe('resolveCompletionSourceForRequest', () => {
  vitest.it('devuelve única fuente cuando hay una sola habilitada', () => {
    vitest.expect(resolveCompletionSourceForRequest('auto', ['copilot'])).toBe('copilot');
    vitest.expect(resolveCompletionSourceForRequest('auto', ['opencode'])).toBe('opencode');
    vitest.expect(resolveCompletionSourceForRequest('auto', ['ollama'])).toBe('ollama');
  });

  vitest.it('prioriza Copilot con auto cuando hay varias fuentes', () => {
    vitest.expect(resolveCompletionSourceForRequest('auto', ['copilot', 'ollama'])).toBe('copilot');
    vitest.expect(resolveCompletionSourceForRequest('auto', ['opencode', 'ollama'])).toBe('opencode');
  });

  vitest.it('enruta ids OpenCode al source correcto', () => {
    vitest.expect(resolveCompletionSourceForRequest('anthropic/claude-3', ['copilot', 'opencode'])).toBe(
      'opencode',
    );
    vitest.expect(resolveCompletionSourceForRequest('gpt-4o-mini', ['copilot', 'opencode'])).toBe(
      'copilot',
    );
    vitest.expect(resolveCompletionSourceForRequest('auto', ['copilot', 'opencode'])).toBe('copilot');
  });

  vitest.it('enruta ids Ollama al source correcto', () => {
    vitest.expect(
      resolveCompletionSourceForRequest('mistral:latest', ['copilot', 'opencode', 'ollama']),
    ).toBe('ollama');
  });

  vitest.it('vuelve a Copilot si el modelo no coincide con OpenCode ni Ollama', () => {
    vitest.expect(resolveCompletionSourceForRequest('gpt-4o-mini', ['copilot', 'opencode', 'ollama'])).toBe(
      'copilot',
    );
  });

  vitest.it('fallback a ollama si no hay copilot ni opencode', () => {
    vitest.expect(resolveCompletionSourceForRequest('unknown', ['ollama'])).toBe('ollama');
  });
});
