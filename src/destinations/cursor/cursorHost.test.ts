/**
 * @file Unit tests for Cursor host detection logic.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

import type { isCursorDesktopHost as isCursorDesktopHostFunction } from './cursorHost';

const appNameMock = vi.hoisted(() => vi.fn(() => 'Visual Studio Code'));

vi.mock('vscode', () => ({
  env: {
    get appName() {
      return appNameMock();
    },
  },
}));

vitest.describe('cursorHost', () => {
  vitest.beforeEach(() => {
    vi.clearAllMocks();
    appNameMock.mockReturnValue('Visual Studio Code');
  });

  vitest.it('isCursorDesktopHost es false en VS Code', async () => {
    const { isCursorDesktopHost } = (await import('./cursorHost')) as {
      isCursorDesktopHost: typeof isCursorDesktopHostFunction;
    };
    vitest.expect(isCursorDesktopHost()).toBe(false);
  });

  vitest.it('isCursorDesktopHost es true cuando appName incluye cursor', async () => {
    appNameMock.mockReturnValue('Cursor');
    const { isCursorDesktopHost } = (await import('./cursorHost')) as {
      isCursorDesktopHost: typeof isCursorDesktopHostFunction;
    };
    vitest.expect(isCursorDesktopHost()).toBe(true);
  });
});
