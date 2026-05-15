import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeCommandMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('vscode', () => ({
  commands: {
    executeCommand: executeCommandMock,
  },
}));

vi.mock('../../src/system/log', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  executeCommandMock.mockReset();
  executeCommandMock.mockResolvedValue(undefined);
});

describe('cursorChatDestination', () => {
  it('sendToCursorChat llama workbench.action.chat.open con { query }', async () => {
    const { sendToCursorChat } = await import('../../src/destinations/cursor/cursorChatDestination');
    await sendToCursorChat('  prompt cursor  ');
    expect(executeCommandMock).toHaveBeenCalledWith('workbench.action.chat.open', {
      query: 'prompt cursor',
    });
  });

  it('reintenta con string si falla el argumento objeto', async () => {
    executeCommandMock
      .mockRejectedValueOnce(new Error('object arg unsupported'))
      .mockResolvedValueOnce(undefined);
    const { sendToCursorChat } = await import('../../src/destinations/cursor/cursorChatDestination');
    await sendToCursorChat('fallback');
    expect(executeCommandMock).toHaveBeenNthCalledWith(1, 'workbench.action.chat.open', {
      query: 'fallback',
    });
    expect(executeCommandMock).toHaveBeenNthCalledWith(2, 'workbench.action.chat.open', 'fallback');
  });

  it('se registra en destinationRegistry como cursorChat', async () => {
    await import('../../src/destinations/cursor/cursorChatDestination');
    const { getDestinationProviderForId } = await import('../../src/destinations/destinationRegistry');
    const provider = getDestinationProviderForId('cursorChat');
    expect(provider).toBeDefined();
    expect(provider!.id).toBe('cursorChat');
    expect(typeof provider!.sendPrompt).toBe('function');
  });
});
