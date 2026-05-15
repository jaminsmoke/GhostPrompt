/**
 * @file Unit tests for Cursor host detection logic.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { isCursorDesktopHost as isCursorDesktopHostFn } from './cursorHost';

const appNameMock = vi.hoisted(() => vi.fn(() => 'Visual Studio Code'));

vi.mock('vscode', () => ({
  env: {
    get appName() {
      return appNameMock();
    },
  },
}));

describe('cursorHost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appNameMock.mockReturnValue('Visual Studio Code');
  });

  it('isCursorDesktopHost es false en VS Code', async () => {
    const { isCursorDesktopHost } = (await import('./cursorHost')) as {
      isCursorDesktopHost: typeof isCursorDesktopHostFn;
    };
    expect(isCursorDesktopHost()).toBe(false);
  });

  it('isCursorDesktopHost es true cuando appName incluye cursor', async () => {
    appNameMock.mockReturnValue('Cursor');
    const { isCursorDesktopHost } = (await import('./cursorHost')) as {
      isCursorDesktopHost: typeof isCursorDesktopHostFn;
    };
    expect(isCursorDesktopHost()).toBe(true);
  });
});
