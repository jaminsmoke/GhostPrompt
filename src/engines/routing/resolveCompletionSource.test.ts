/**
 * @file Tests de enrutamiento de fuentes de completado.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../modelIdChecks', () => ({
  looksLikeOllamaModelId: (id: string) => id.includes(':') && !id.includes('/'),
  looksLikeOpencodeModelId: (id: string) => {
    const t = id.trim();
    const slash = t.indexOf('/');
    if (slash <= 0 || slash === t.length - 1) { return false; }
    return !t.includes('//') && t.split('/').length === 2;
  },
}));

import { resolveCompletionSourceForRequest } from './resolveCompletionSource';

describe('resolveCompletionSourceForRequest', () => {
  it('devuelve única fuente cuando hay una sola habilitada', () => {
    expect(resolveCompletionSourceForRequest('auto', ['copilot'])).toBe('copilot');
    expect(resolveCompletionSourceForRequest('auto', ['opencode'])).toBe('opencode');
    expect(resolveCompletionSourceForRequest('auto', ['ollama'])).toBe('ollama');
  });

  it('prioriza Copilot con auto cuando hay varias fuentes', () => {
    expect(resolveCompletionSourceForRequest('auto', ['copilot', 'ollama'])).toBe('copilot');
    expect(resolveCompletionSourceForRequest('auto', ['opencode', 'ollama'])).toBe('opencode');
  });

  it('enruta ids OpenCode al source correcto', () => {
    expect(resolveCompletionSourceForRequest('anthropic/claude-3', ['copilot', 'opencode'])).toBe(
      'opencode',
    );
    expect(resolveCompletionSourceForRequest('gpt-4o-mini', ['copilot', 'opencode'])).toBe(
      'copilot',
    );
    expect(resolveCompletionSourceForRequest('auto', ['copilot', 'opencode'])).toBe('copilot');
  });

  it('enruta ids Ollama al source correcto', () => {
    expect(
      resolveCompletionSourceForRequest('mistral:latest', ['copilot', 'opencode', 'ollama']),
    ).toBe('ollama');
  });

  it('vuelve a Copilot si el modelo no coincide con OpenCode ni Ollama', () => {
    expect(resolveCompletionSourceForRequest('gpt-4o-mini', ['copilot', 'opencode', 'ollama'])).toBe(
      'copilot',
    );
  });

  it('fallback a ollama si no hay copilot ni opencode', () => {
    expect(resolveCompletionSourceForRequest('unknown', ['ollama'])).toBe('ollama');
  });
});
