/**
 * @file Pruebas de notificación del destino VSOpenCodeX cuando la extensión no está instalada.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const configGetMock = vi.hoisted(
  () => vi.fn<(key: string, fallback: unknown) => unknown>((_key, fallback) => fallback),
);
const getExtensionMock = vi.hoisted(() => vi.fn<(id: string) => unknown>(() => undefined));
const showInformationMessageMock = vi.hoisted(
  () => vi.fn<(message: string, button: string) => Promise<unknown>>(
    () => Promise.resolve(undefined),
  ),
);

const mockedVscode = {
  workspace: {
    getConfiguration: () => ({
      get: (key: string, fallback: unknown): unknown => configGetMock(key, fallback),
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
    executeCommand: vi.fn<Promise<unknown>, [string, unknown]>(),
  },
} as unknown as typeof import('vscode');

vi.mock('vscode', () => mockedVscode);

describe('notifyVsxAgentDestinationIfExtensionMissing', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    configGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === 'agentDestination' ? 'copilotChat' : fallback,
    );
    getExtensionMock.mockReturnValue(undefined);
  });

  it('no notifica si destino es Copilot Chat', async () => {
    const { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } =
      (await import('./vsOpenCodeXDestination')) as {
        notifyIfVsxAgentDestinationWithoutVsOpenCodeX: () => void;
      };
    notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
    expect(showInformationMessageMock).not.toHaveBeenCalled();
  });

  it('notifica una vez por sesión si destino VSX y extensión ausente', async () => {
    configGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === 'agentDestination' ? 'vsOpenCodeX' : fallback,
    );
    const { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } =
      (await import('./vsOpenCodeXDestination')) as {
        notifyIfVsxAgentDestinationWithoutVsOpenCodeX: () => void;
      };
    notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
    notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
    expect(showInformationMessageMock).toHaveBeenCalledTimes(1);
  });

  it('reinicia el aviso al volver a copilotChat y otra vez a VSX', async () => {
    const { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } =
      (await import('./vsOpenCodeXDestination')) as {
        notifyIfVsxAgentDestinationWithoutVsOpenCodeX: () => void;
      };
    configGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === 'agentDestination' ? 'vsOpenCodeX' : fallback,
    );
    notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
    configGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === 'agentDestination' ? 'copilotChat' : fallback,
    );
    notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
    configGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === 'agentDestination' ? 'vsOpenCodeX' : fallback,
    );
    notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
    expect(showInformationMessageMock).toHaveBeenCalledTimes(2);
  });

  it('no notifica si la extensión VSX está presente', async () => {
    configGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === 'agentDestination' ? 'vsOpenCodeX' : fallback,
    );
    getExtensionMock.mockReturnValue({ id: 'jaminsmoke.vsopencodex' });
    const { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } =
      (await import('./vsOpenCodeXDestination')) as {
        notifyIfVsxAgentDestinationWithoutVsOpenCodeX: () => void;
      };
    notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
    expect(showInformationMessageMock).not.toHaveBeenCalled();
  });
});
