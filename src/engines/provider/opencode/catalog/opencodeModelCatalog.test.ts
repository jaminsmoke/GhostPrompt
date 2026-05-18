/**
 * @file Pruebas del catálogo de modelos OpenCode.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

const { configProvidersMock, fakeSdkClient } = vi.hoisted(() => {
  const configProvidersMock = vi.fn();
  const fakeSdkClient = {
    config: { providers: configProvidersMock },
  };
  return { configProvidersMock, fakeSdkClient };
});

vi.mock('@opencode-ai/sdk', () => ({
  createOpencodeClient: vi.fn(() => fakeSdkClient),
}));

const cfgGetMock = vi.fn();
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: cfgGetMock,
    }),
  },
}));

import { OPENCODE_DEFAULT_PORT } from '../../../../system/internals/protocols/types/typeOpencodeClient';

import { listOpencodeSuggestionModels } from './opencodeModelCatalog';

vitest.beforeEach(() => {
  vi.resetAllMocks();
  cfgGetMock.mockImplementation((key: string, defaultValue: unknown) => {
    if (key === 'opencodeExcludedModelIds') {
      return [];
    }
    if (key === 'opencodePort') {
      return OPENCODE_DEFAULT_PORT;
    }
    if (key === 'opencodeAuthToken') {
      return defaultValue;
    }
    return defaultValue;
  });
});

vitest.describe('listOpencodeSuggestionModels', () => {
  vitest.it('returns empty array when createOpenCodeClient throws', async () => {
    const sdk = await import('@opencode-ai/sdk');
    vi.mocked(sdk.createOpencodeClient).mockImplementation(() => {
      throw new Error('CLI missing');
    });
    const models = await listOpencodeSuggestionModels('nonPremiumOnly');
    vitest.expect(models).toEqual([]);
  });

  vitest.it('maps models array from config.providers() into descriptors', async () => {
    configProvidersMock.mockResolvedValue({
      data: {
        providers: [
          {
            id: 'openai',
            name: 'OpenAI',
            models: [
              { id: 'gpt-4o-mini', name: 'GPT-4o mini', pricing: '0x' },
              { id: 'gpt-4', name: 'GPT-4', pricing: '1x' },
            ],
          },
        ],
        default: {},
      },
    });

    const models = await listOpencodeSuggestionModels('anyModel');
    vitest.expect(models).toHaveLength(2);
    vitest.expect(models.map((m) => m.id).toSorted()).toEqual(['openai/gpt-4', 'openai/gpt-4o-mini']);
    vitest.expect(models.find((m) => m.id === 'openai/gpt-4o-mini')?.tier).toBe('included');
    vitest.expect(models.find((m) => m.id === 'openai/gpt-4')?.tier).toBe('premium');
  });

  vitest.it('maps config.providers() map-shaped models into descriptors', async () => {
    configProvidersMock.mockResolvedValue({
      data: {
        providers: [
          {
            id: 'anthropic',
            name: 'Anthropic',
            models: {
              m1: { id: 'claude-3', name: 'Claude 3' },
            },
          },
        ],
        default: {},
      },
    });

    const models = await listOpencodeSuggestionModels('nonPremiumOnly');
    vitest.expect(models).toHaveLength(1);
    vitest.expect(models[0]).toMatchObject({
      id: 'anthropic/claude-3',
      label: 'Claude 3',
      tier: 'unknown',
      provider: 'Anthropic',
    });
  });

  vitest.it('respects ghostPrompt.opencodeExcludedModelIds', async () => {
    cfgGetMock.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'opencodeExcludedModelIds') {
        return ['anthropic/claude-3'];
      }
      if (key === 'opencodePort') {
      return OPENCODE_DEFAULT_PORT;
    }
      if (key === 'opencodeAuthToken') {
        return defaultValue;
      }
      return defaultValue;
    });

    configProvidersMock.mockResolvedValue({
      data: {
        providers: [
          {
            id: 'anthropic',
            name: 'Anthropic',
            models: {
              m1: { id: 'claude-3', name: 'Claude 3' },
            },
          },
        ],
        default: {},
      },
    });

    vitest.expect(await listOpencodeSuggestionModels('nonPremiumOnly')).toEqual([]);
  });

  vitest.it('returns empty on providers() throw', async () => {
    configProvidersMock.mockRejectedValue(new Error('network'));
    vitest.expect(await listOpencodeSuggestionModels('nonPremiumOnly')).toEqual([]);
  });
});
