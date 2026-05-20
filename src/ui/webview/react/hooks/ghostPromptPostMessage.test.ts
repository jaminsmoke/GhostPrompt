/**
 * @file Tests del singleton acquireVsCodeApi en postToHost.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

import { getGhostPromptVsCodeApi, postToHost } from './ghostPromptPostMessage';

vitest.describe('ghostPromptPostMessage', () => {
  vitest.afterEach(() => {
    const g = globalThis as typeof globalThis & {
      acquireVsCodeApi?: () => { postMessage: (m: unknown) => void };
      __ghostPromptVsCodeApi?: { postMessage: (m: unknown) => void };
    };
    delete g.__ghostPromptVsCodeApi;
    delete g.acquireVsCodeApi;
  });

  vitest.it('acquireVsCodeApi solo se invoca una vez aunque postToHost se llame varias veces', () => {
    const postMessage = vi.fn();
    let acquireCount = 0;
    const g = globalThis as typeof globalThis & {
      acquireVsCodeApi?: () => { postMessage: (m: unknown) => void };
    };
    g.acquireVsCodeApi = () => {
      acquireCount += 1;
      return { postMessage };
    };

    postToHost({ type: 'init' });
    postToHost({ type: 'log', level: 'info', message: 'second' });

    vitest.expect(acquireCount).toBe(1);
    vitest.expect(postMessage).toHaveBeenCalledTimes(2);
  });

  vitest.it('getGhostPromptVsCodeApi devuelve la misma instancia cacheada', () => {
    const g = globalThis as typeof globalThis & {
      acquireVsCodeApi?: () => { postMessage: (m: unknown) => void };
    };
    const api = { postMessage: vi.fn() };
    const acquire = vi.fn(() => api);
    g.acquireVsCodeApi = acquire;

    const first = getGhostPromptVsCodeApi();
    const second = getGhostPromptVsCodeApi();

    vitest.expect(first).toBe(api);
    vitest.expect(second).toBe(api);
    vitest.expect(acquire).toHaveBeenCalledTimes(1);
  });
});
