/**
 * @file Pruebas del catálogo de modelos Ollama.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

const { listModelsMock, getConfigurationMock, configMock } = vi.hoisted(() => ({
  listModelsMock: vi.fn(),
  getConfigurationMock: vi.fn(),
  configMock: {
    get: vi.fn((key: string, defaultValue: unknown) => {
      if (key === 'ollamaExcludedModelIds') {
        return defaultValue;
      }
      if (key === 'ollamaBaseUrl') {
        return 'http://localhost:11434';
      }
      return defaultValue;
    }),
  },
}));

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: getConfigurationMock,
  },
}));

vi.mock('../http/ollamaApiClient', () => ({
  listModels: listModelsMock,
}));

import { listOllamaSuggestionModels } from './ollamaModelCatalog';

vitest.describe('listOllamaSuggestionModels', () => {
  vitest.beforeEach(() => {
    vi.clearAllMocks();
    getConfigurationMock.mockReturnValue(configMock);
  });

  vitest.it('returns normalized descriptors sorted by label and excludes configured models', async () => {
    listModelsMock.mockResolvedValue([
      { name: 'zeta:latest' },
      { name: 'alpha:latest' },
      { name: 'excluded-model' },
    ]);
    configMock.get.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'ollamaExcludedModelIds') {
        return ['excluded-model'];
      }
      if (key === 'ollamaBaseUrl') {
        return 'http://localhost:11434';
      }
      return defaultValue;
    });

    const models = await listOllamaSuggestionModels('anyModel');

    vitest.expect(models).toEqual([
      {
        id: 'alpha:latest',
        label: 'alpha:latest',
        tier: 'included',
        provider: 'ollama',
        completionSource: 'ollama',
      },
      {
        id: 'zeta:latest',
        label: 'zeta:latest',
        tier: 'included',
        provider: 'ollama',
        completionSource: 'ollama',
      },
    ]);
  });

  vitest.it('returns unavailable fallback when Ollama API fails', async () => {
    listModelsMock.mockRejectedValue(new Error('Network error'));

    const models = await listOllamaSuggestionModels('anyModel');

    vitest.expect(models).toEqual([
      {
        id: 'ollama/unavailable',
        label: 'Ollama (no disponible)',
        tier: 'unknown',
        completionSource: 'ollama',
        provider: 'ollama',
      },
    ]);
  });
});
