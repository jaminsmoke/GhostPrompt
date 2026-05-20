/**
 * @file Unit tests for the Copilot Chat destination forwarding logic.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

import type { DestinationProvider } from '../destinationRegistry';

const executeCommandMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('vscode', () => ({
  commands: {
    executeCommand: executeCommandMock,
  },
}));

vitest.beforeEach(() => {
  vi.clearAllMocks();
});

vitest.describe('copilotChatDestination', () => {
  vitest.it('exporta sendToChat que llama a workbench.action.chat.open', async () => {
    const { sendToChat } = (await import('./copilotChatDestination')) as {
      sendToChat: (query: string) => Promise<void>;
    };
    await sendToChat('test prompt');
    vitest.expect(executeCommandMock).toHaveBeenCalledWith('workbench.action.chat.open', {
      query: 'test prompt',
    });
  });

  vitest.it('se registra automaticamente en destinationRegistry como copilotChat', async () => {
    // Importar el módulo real (efecto secundario: se registra el provider)
    await import('./copilotChatDestination');
    const { getDestinationProviderForId } = (await import('../destinationRegistry')) as {
      getDestinationProviderForId: (id: 'copilotChat') => DestinationProvider | undefined;
    };
    const provider = getDestinationProviderForId('copilotChat');
    vitest.expect(provider).toBeDefined();
    if (!provider) {
      return;
    }
    vitest.expect(provider.id).toBe('copilotChat');
    vitest.expect(typeof provider.sendPrompt).toBe('function');
  });
});
