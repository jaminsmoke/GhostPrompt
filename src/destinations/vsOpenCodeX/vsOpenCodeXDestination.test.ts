import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeCommandMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const configGetMock = vi.hoisted(() => vi.fn());
const getExtensionMock = vi.hoisted(() => vi.fn());
const showInformationMessageMock = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: configGetMock,
      inspect: () => ({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      }),
    }),
  },
  extensions: {
    getExtension: getExtensionMock,
  },
  window: {
    showInformationMessage: showInformationMessageMock,
  },
  commands: {
    executeCommand: executeCommandMock,
  },
}));

vi.mock('../../system/log', () => ({
  getLogger: () => ({
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe('vsOpenCodeXDestination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === 'agentDestination' ? 'copilotChat' : fallback,
    );
    getExtensionMock.mockReturnValue(undefined);
  });

  describe('forwardGhostPromptInlineUiToVsOpenCodeIfApplicable', () => {
    it('no llama executeCommand si destino es Copilot', async () => {
      configGetMock.mockReturnValue('copilotChat');
      const { forwardGhostPromptInlineUiToVsOpenCodeIfApplicable } =
        await import('./vsOpenCodeXDestination');
      forwardGhostPromptInlineUiToVsOpenCodeIfApplicable({
        type: 'suggestion',
        suggestion: 'x',
        broadcast: true,
      });
      expect(executeCommandMock).not.toHaveBeenCalled();
    });

    it('reenvía suggestion sin broadcast si destino es VSX', async () => {
      configGetMock.mockReturnValue('vsOpenCodeX');
      const { forwardGhostPromptInlineUiToVsOpenCodeIfApplicable } =
        await import('./vsOpenCodeXDestination');
      forwardGhostPromptInlineUiToVsOpenCodeIfApplicable({
        type: 'suggestion',
        suggestion: 'x',
        broadcast: true,
      });
      expect(executeCommandMock).toHaveBeenCalledWith('vsopencodex.ghostPromptInlineUi', {
        type: 'suggestion',
        suggestion: 'x',
      });
    });

    it('reenvía tipos válidos (loading, empty, error, clear)', async () => {
      configGetMock.mockReturnValue('vsOpenCodeX');
      const { forwardGhostPromptInlineUiToVsOpenCodeIfApplicable } =
        await import('./vsOpenCodeXDestination');
      for (const type of ['loading', 'empty', 'error', 'clear']) {
        vi.clearAllMocks();
        forwardGhostPromptInlineUiToVsOpenCodeIfApplicable({
          type,
          broadcast: true,
        });
        expect(executeCommandMock).toHaveBeenCalledWith('vsopencodex.ghostPromptInlineUi', {
          type,
        });
      }
    });
  });

  describe('notifyIfVsxAgentDestinationWithoutVsOpenCodeX', () => {
    it('no notifica si destino es copilotChat', async () => {
      configGetMock.mockReturnValue('copilotChat');
      const { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } =
        await import('./vsOpenCodeXDestination');
      notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
      expect(showInformationMessageMock).not.toHaveBeenCalled();
    });

    it('notifica una vez si destino es vsOpenCodeX y extensión ausente', async () => {
      configGetMock.mockReturnValue('vsOpenCodeX');
      getExtensionMock.mockReturnValue(undefined);
      const { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } =
        await import('./vsOpenCodeXDestination');
      notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
      notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
      expect(showInformationMessageMock).toHaveBeenCalledTimes(1);
    });
  });
});
