/**
 * @file Pruebas del adaptador de estado OpenCode.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const configGetMock = vi.hoisted(() => vi.fn());
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({ get: configGetMock }),
  },
  window: {
    createTerminal: vi.fn(() => ({
      sendText: vi.fn(),
      dispose: vi.fn(),
      name: 'GhostPrompt OpenCode',
    })),
    terminals: [],
  },
}));

import { opencodeStatusModule } from './opencodeProviderStatus';

describe('opencodeStatusModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    configGetMock.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'opencodeBaseUrl') {
        return 'http://127.0.0.1:4096';
      }
      return fallback;
    });
  });

  it('retorna running si el ping HTTP responde ok', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    const state = await opencodeStatusModule.check();
    expect(state.status).toBe('running');
    expect(state.actions).toContain('stop');
  });

  it('retorna stopped si el ping HTTP falla', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('fetch failed'));
    vi.stubGlobal('fetch', mockFetch);

    const state = await opencodeStatusModule.check();
    expect(state.status).toBe('stopped');
    expect(state.actions).toContain('start');
  });
});
