import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeCommandMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const workspaceConfigGetMock = vi.hoisted(() =>
  vi.fn((key: string, fallback: unknown) => fallback),
);

vi.mock('../src/system/log', () => ({
  getLogger: () => ({
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock('vscode', () => ({
  commands: {
    executeCommand: (...args: unknown[]) => executeCommandMock(...args),
  },
  workspace: {
    getConfiguration: () => ({
      get: workspaceConfigGetMock,
      inspect: () => ({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      }),
    }),
  },
}));

import {
  forwardGhostPromptInlineUiToVsOpenCodeIfApplicable,
  VS_OPEN_CODE_X_GHOST_PROMPT_INLINE_UI,
} from '../src/destinations/vsOpenCodeX/vsOpenCodeXDestination';

describe('vsOpenCodeXGhostPromptUiBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceConfigGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === 'agentDestination' ? 'copilotChat' : fallback,
    );
  });

  it('no llama executeCommand si destino es Copilot', () => {
    forwardGhostPromptInlineUiToVsOpenCodeIfApplicable({
      type: 'suggestion',
      captureId: 1,
      suggestion: 'x',
      broadcast: true,
    });
    expect(executeCommandMock).not.toHaveBeenCalled();
  });

  it('reenvía tipo permitido sin campo broadcast si destino VSX', () => {
    workspaceConfigGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === 'agentDestination' ? 'vsOpenCodeX' : fallback,
    );
    forwardGhostPromptInlineUiToVsOpenCodeIfApplicable({
      type: 'loading',
      captureId: 3,
      broadcast: true,
    });
    expect(executeCommandMock).toHaveBeenCalledWith(VS_OPEN_CODE_X_GHOST_PROMPT_INLINE_UI, {
      type: 'loading',
      captureId: 3,
    });
  });
});
