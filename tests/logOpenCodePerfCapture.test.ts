import { beforeEach, describe, expect, it, vi } from 'vitest';

const appendLine = vi.fn();

const { configGet } = vi.hoisted(() => ({
  configGet: vi.fn((_key: string, defaultValue: unknown) => defaultValue),
}));

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: configGet,
    })),
  },
  window: {
    createOutputChannel: vi.fn(() => ({ appendLine })),
  },
}));

import { logOpenCodePerfCapture } from '../src/system/debug/SuggestionDebug';

describe('logOpenCodePerfCapture', () => {
  beforeEach(() => {
    appendLine.mockClear();
    configGet.mockImplementation((_k, def) => def);
  });

  it('no emite cuando debugSuggestions está desactivado', () => {
    configGet.mockImplementation((key: string) => (key === 'debugSuggestions' ? false : undefined));

    logOpenCodePerfCapture(1, 'phase', 'detail');
    expect(appendLine).not.toHaveBeenCalled();
  });

  it('emite una línea con opencode-perf y capture cuando debug está activo', () => {
    configGet.mockImplementation((key: string, def: unknown) =>
      key === 'debugSuggestions' ? true : def,
    );

    logOpenCodePerfCapture(9, 'runtime-ready', 'elapsedMs=12');
    expect(appendLine).toHaveBeenCalledTimes(1);
    const line = appendLine.mock.calls[0]![0] as string;
    expect(line).toContain('[capture:9]');
    expect(line).toContain('[opencode-perf]');
    expect(line).toContain('[runtime-ready]');
    expect(line).toContain('elapsedMs=12');
  });
});
