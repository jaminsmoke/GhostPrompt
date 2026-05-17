/**
 * @file Pruebas del módulo de estado I/O del servidor OpenCode (`ProviderStatusModule`).
 */

import * as vitest from 'vitest';
import { vi } from 'vitest';

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

import { opencodeStatusModule } from './opencodeServerStatusModule';

vitest.describe('opencodeStatusModule', () => {
  vitest.beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    configGetMock.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'opencodeBaseUrl') {
        return 'http://127.0.0.1:4096';
      }
      return fallback;
    });
  });

  vitest.it('retorna running si el ping HTTP responde ok', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    const state = await opencodeStatusModule.check();
    vitest.expect(state.status).toBe('running');
    vitest.expect(state.actions).toContain('stop');
  });

  vitest.it('retorna stopped si el ping HTTP falla', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('fetch failed'));
    vi.stubGlobal('fetch', mockFetch);

    const state = await opencodeStatusModule.check();
    vitest.expect(state.status).toBe('stopped');
    vitest.expect(state.actions).toContain('start');
  });
});
