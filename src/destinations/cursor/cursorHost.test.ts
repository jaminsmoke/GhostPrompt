import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    const { isCursorDesktopHost } = await import('./cursorHost');
    expect(isCursorDesktopHost()).toBe(false);
  });

  it('isCursorDesktopHost es true cuando appName incluye cursor', async () => {
    appNameMock.mockReturnValue('Cursor');
    const { isCursorDesktopHost } = await import('./cursorHost');
    expect(isCursorDesktopHost()).toBe(true);
  });
});
