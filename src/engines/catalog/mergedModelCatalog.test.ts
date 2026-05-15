/**
 * @file Pruebas de catálogo de modelos fusionados para sugerencias.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListSuggestionModels = vi.hoisted(() => vi.fn());
const mockListOpencodeSuggestionModels = vi.hoisted(() => vi.fn());
const mockListOllamaSuggestionModels = vi.hoisted(() => vi.fn());

vi.mock('../copilot/catalog/modelCatalog', () => ({
  listSuggestionModels: mockListSuggestionModels,
}));

vi.mock('../opencode/catalog/opencodeModelCatalog', () => ({
  listOpencodeSuggestionModels: mockListOpencodeSuggestionModels,
}));

vi.mock('../ollama/catalog/ollamaModelCatalog', () => ({
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

describe('listMergedSuggestionModels', () => {
  beforeEach(() => {
    mockListSuggestionModels.mockReset();
    mockListOpencodeSuggestionModels.mockReset();
    mockListOllamaSuggestionModels.mockReset();
  });

  it('returns only copilot models when only copilot is enabled', async () => {
    mockListSuggestionModels.mockResolvedValue([
      { id: 'gpt-4', label: 'GPT-4', tier: 'included', provider: 'OpenAI' },
    ]);

    const models = await listMergedSuggestionModels('nonPremiumOnly', ['copilot']);
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('gpt-4');
    expect(mockListOpencodeSuggestionModels).not.toHaveBeenCalled();
    expect(mockListOllamaSuggestionModels).not.toHaveBeenCalled();
  });

  it('includes ollama models when ollama source is enabled', async () => {
    mockListSuggestionModels.mockResolvedValue([
      { id: 'gpt-4', label: 'GPT-4', tier: 'included', provider: 'OpenAI' },
    ]);
    mockListOllamaSuggestionModels.mockResolvedValue([
      { id: 'mistral:latest', label: 'mistral:latest', tier: 'included', provider: 'ollama' },
    ]);

    const models = await listMergedSuggestionModels('nonPremiumOnly', ['copilot', 'ollama']);
    expect(models).toHaveLength(2);
    expect(models.map((m) => m.id).sort()).toEqual(['gpt-4', 'mistral:latest']);
  });

  it('deduplicates models with same id across sources', async () => {
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
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('shared-model');
  });

  it('returns empty array when all catalogs return empty', async () => {
    mockListSuggestionModels.mockResolvedValue([]);
    mockListOpencodeSuggestionModels.mockResolvedValue([]);
    mockListOllamaSuggestionModels.mockResolvedValue([]);

    const models = await listMergedSuggestionModels('nonPremiumOnly', [
      'copilot',
      'opencode',
      'ollama',
    ]);
    expect(models).toEqual([]);
  });

  it('propagates errors from individual catalogs', async () => {
    mockListSuggestionModels.mockRejectedValue(new Error('copilot error'));

    await expect(
      listMergedSuggestionModels('anyModel', ['copilot', 'opencode', 'ollama']),
    ).rejects.toThrow('copilot error');
  });
});
