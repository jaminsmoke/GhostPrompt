/**
 * @file Pruebas de catálogo de modelos fusionados para sugerencias.
 */

import * as vitest from 'vitest';
import { vi } from 'vitest';

const mockListSuggestionModels = vi.hoisted(() => vi.fn());
const mockListOpencodeSuggestionModels = vi.hoisted(() => vi.fn());
const mockListOllamaSuggestionModels = vi.hoisted(() => vi.fn());

vi.mock('./copilot/catalog/modelCatalog', () => ({
  listSuggestionModels: mockListSuggestionModels,
}));

vi.mock('./opencode/catalog/opencodeModelCatalog', () => ({
  listOpencodeSuggestionModels: mockListOpencodeSuggestionModels,
}));

vi.mock('./ollama/catalog/ollamaModelCatalog', () => ({
  listOllamaSuggestionModels: mockListOllamaSuggestionModels,
}));

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: vi.fn(() => []),
    }),
  },
}));

import { listMergedSuggestionModels } from './mergedModelCatalog';

vitest.describe('listMergedSuggestionModels', () => {
  vitest.beforeEach(() => {
    mockListSuggestionModels.mockReset();
    mockListOpencodeSuggestionModels.mockReset();
    mockListOllamaSuggestionModels.mockReset();
  });

  vitest.it('returns only copilot models when only copilot is enabled', async () => {
    mockListSuggestionModels.mockResolvedValue([
      { id: 'gpt-4', label: 'GPT-4', tier: 'included', provider: 'OpenAI' },
    ]);

    const models = await listMergedSuggestionModels('nonPremiumOnly', ['copilot']);
    vitest.expect(models).toHaveLength(1);
    vitest.expect(models[0].id).toBe('gpt-4');
    vitest.expect(mockListOpencodeSuggestionModels).not.toHaveBeenCalled();
    vitest.expect(mockListOllamaSuggestionModels).not.toHaveBeenCalled();
  });

  vitest.it('includes ollama models when ollama source is enabled', async () => {
    mockListSuggestionModels.mockResolvedValue([
      { id: 'gpt-4', label: 'GPT-4', tier: 'included', provider: 'OpenAI' },
    ]);
    mockListOllamaSuggestionModels.mockResolvedValue([
      { id: 'mistral:latest', label: 'mistral:latest', tier: 'included', provider: 'ollama' },
    ]);

    const models = await listMergedSuggestionModels('nonPremiumOnly', ['copilot', 'ollama']);
    vitest.expect(models).toHaveLength(2);
    vitest.expect(models.map((m) => m.id).toSorted()).toEqual(['gpt-4', 'mistral:latest']);
  });

  vitest.it('deduplicates models with same id across sources', async () => {
    mockListSuggestionModels.mockResolvedValue([
      { id: 'shared-model', label: 'Shared', tier: 'included', provider: 'Copilot' },
    ]);
    mockListOpencodeSuggestionModels.mockResolvedValue([
      { id: 'shared-model', label: 'Shared', tier: 'included', provider: 'OpenCode Provider' },
    ]);
    mockListOllamaSuggestionModels.mockResolvedValue([
      { id: 'shared-model', label: 'Shared', tier: 'included', provider: 'ollama' },
    ]);

    const models = await listMergedSuggestionModels('anyModel', ['copilot', 'opencode', 'ollama']);
    vitest.expect(models).toHaveLength(1);
    vitest.expect(models[0].id).toBe('shared-model');
  });

  vitest.it('returns empty array when all catalogs return empty', async () => {
    mockListSuggestionModels.mockResolvedValue([]);
    mockListOpencodeSuggestionModels.mockResolvedValue([]);
    mockListOllamaSuggestionModels.mockResolvedValue([]);

    const models = await listMergedSuggestionModels('nonPremiumOnly', [
      'copilot',
      'opencode',
      'ollama',
    ]);
    vitest.expect(models).toEqual([]);
  });

  vitest.it('propagates errors from individual catalogs', async () => {
    mockListSuggestionModels.mockRejectedValue(new Error('copilot error'));

    await vitest.expect(
      listMergedSuggestionModels('anyModel', ['copilot', 'opencode', 'ollama']),
    ).rejects.toThrow('copilot error');
  });
});
