/**
 * @file Unit tests for the Copilot Chat destination forwarding logic.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DestinationProvider } from '../destinationRegistry';

const executeCommandMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('vscode', () => ({
  commands: {
    executeCommand: executeCommandMock,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('copilotChatDestination', () => {
  it('exporta sendToChat que llama a workbench.action.chat.open', async () => {
    const { sendToChat } = (await import('./copilotChatDestination')) as {
      sendToChat: (query: string) => Promise<void>;
    };
    await sendToChat('test prompt');
    expect(executeCommandMock).toHaveBeenCalledWith('workbench.action.chat.open', {
      query: 'test prompt',
    });
  });

  it('se registra automaticamente en destinationRegistry como copilotChat', async () => {
    // Importar el módulo real (efecto secundario: se registra el provider)
    await import('./copilotChatDestination');
    const { getDestinationProviderForId } = (await import('../destinationRegistry')) as {
      getDestinationProviderForId(id: 'copilotChat'): DestinationProvider | undefined;
    };
    const provider = getDestinationProviderForId('copilotChat');
    expect(provider).toBeDefined();
    if (!provider) {
      return;
    }
    expect(provider.id).toBe('copilotChat');
    expect(typeof provider.sendPrompt).toBe('function');
  });
});
