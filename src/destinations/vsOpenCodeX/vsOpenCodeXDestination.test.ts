/**
 * @file Pruebas del destino VSOpenCodeX (reenvío UI vía comando y aviso si falta la extensión).
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

import {
  OUTBOUND_UI_FORWARD_KINDS,
  VS_OPEN_CODE_X_INLINE_UI_COMMAND,
} from '../../system/internals/protocols/constants';

import type * as Vscode from 'vscode';


const executeCommandMock = vi.hoisted(
  () =>
    vi.fn<(command: string, args: Record<string, unknown>) => Promise<unknown>>(() =>
      Promise.resolve(),
    ),
);
const configGetMock = vi.hoisted(() => vi.fn<(key: string, fallback?: unknown) => unknown>());
const getExtensionMock = vi.hoisted(() => vi.fn<(extensionId: string) => unknown>());
const showInformationMessageMock = vi.hoisted(
  () =>
    vi.fn<(message: string, action: string) => Promise<unknown>>(() => Promise.resolve()),
);

const mockedVscode = {
  workspace: {
    getConfiguration: () => ({
      get: configGetMock,
      inspect: () => ({}),
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
} as unknown as typeof Vscode;

vi.mock('vscode', () => mockedVscode);

vi.mock('../../system/log', () => ({
  getLogger: () => ({
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

/**
 * Restaura mocks del destino VSOpenCodeX antes de cada test.
 * @returns {void}
 */
function resetVsOpenCodeXDestinationMocks(): void {
  vi.resetModules();
  vi.clearAllMocks();
  configGetMock.mockImplementation((key: string, fallback: unknown) => {
    return key === 'agentDestination' ? 'copilotChat' : fallback;
  });
  getExtensionMock.mockReturnValue();
}

vitest.describe('forwardGhostPromptInlineUiToVsOpenCodeIfApplicable', () => {
  vitest.beforeEach(resetVsOpenCodeXDestinationMocks);
    vitest.it('no llama executeCommand si destino es Copilot', async () => {
      configGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'copilotChat' : fallback;
    });
      const { forwardGhostPromptInlineUiToVsOpenCodeIfApplicable } =
        (await import('./vsOpenCodeXDestination')) as {
          forwardGhostPromptInlineUiToVsOpenCodeIfApplicable: (
            payloadWithBroadcast: Record<string, unknown>,
          ) => void;
        };
      forwardGhostPromptInlineUiToVsOpenCodeIfApplicable({
        type: 'suggestion',
        suggestion: 'x',
        broadcast: true,
      });
      vitest.expect(executeCommandMock).not.toHaveBeenCalled();
    });

    vitest.it('reenvía suggestion sin broadcast si destino es VSOpenCodeX', async () => {
      configGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'vsOpenCodeX' : fallback;
    });
      const { forwardGhostPromptInlineUiToVsOpenCodeIfApplicable } =
        (await import('./vsOpenCodeXDestination')) as {
          forwardGhostPromptInlineUiToVsOpenCodeIfApplicable: (
            payloadWithBroadcast: Record<string, unknown>,
          ) => void;
        };
      forwardGhostPromptInlineUiToVsOpenCodeIfApplicable({
        type: 'suggestion',
        suggestion: 'x',
        broadcast: true,
      });
      vitest.expect(executeCommandMock).toHaveBeenCalledWith(VS_OPEN_CODE_X_INLINE_UI_COMMAND, {
        type: 'suggestion',
        suggestion: 'x',
      });
    });

    vitest.it('reenvía cada tipo contratado en OUTBOUND_UI_FORWARD_KINDS salvo suggestion ya cubierta', async () => {
      configGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'vsOpenCodeX' : fallback;
    });
      const { forwardGhostPromptInlineUiToVsOpenCodeIfApplicable } =
        (await import('./vsOpenCodeXDestination')) as {
          forwardGhostPromptInlineUiToVsOpenCodeIfApplicable: (
            payloadWithBroadcast: Record<string, unknown>,
          ) => void;
        };
      const kinds = OUTBOUND_UI_FORWARD_KINDS.filter((k) => k !== 'suggestion');
      for (const type of kinds) {
        vi.clearAllMocks();
        forwardGhostPromptInlineUiToVsOpenCodeIfApplicable({
          type,
          broadcast: true,
        });
        vitest.expect(executeCommandMock).toHaveBeenCalledWith(VS_OPEN_CODE_X_INLINE_UI_COMMAND, {
          type,
        });
      }
    });

    vitest.it('preserva captureId y elimina broadcast en loading', async () => {
      configGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'vsOpenCodeX' : fallback;
    });
      const { forwardGhostPromptInlineUiToVsOpenCodeIfApplicable } =
        (await import('./vsOpenCodeXDestination')) as {
          forwardGhostPromptInlineUiToVsOpenCodeIfApplicable: (
            payloadWithBroadcast: Record<string, unknown>,
          ) => void;
        };
      forwardGhostPromptInlineUiToVsOpenCodeIfApplicable({
        type: 'loading',
        captureId: 3,
        broadcast: true,
      });
      vitest.expect(executeCommandMock).toHaveBeenCalledWith(VS_OPEN_CODE_X_INLINE_UI_COMMAND, {
        type: 'loading',
        captureId: 3,
      });
    });

    vitest.it('no reenvía tipos fuera del contrato', async () => {
      configGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'vsOpenCodeX' : fallback;
    });
      const { forwardGhostPromptInlineUiToVsOpenCodeIfApplicable } =
        (await import('./vsOpenCodeXDestination')) as {
          forwardGhostPromptInlineUiToVsOpenCodeIfApplicable: (
            payloadWithBroadcast: Record<string, unknown>,
          ) => void;
        };
      forwardGhostPromptInlineUiToVsOpenCodeIfApplicable({
        type: 'settings',
        broadcast: true,
      });
      vitest.expect(executeCommandMock).not.toHaveBeenCalled();
    });
});

vitest.describe('notifyIfVsxAgentDestinationWithoutVsOpenCodeX', () => {
  vitest.beforeEach(resetVsOpenCodeXDestinationMocks);
    vitest.it('no notifica si destino es copilotChat', async () => {
      configGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'copilotChat' : fallback;
    });
      const { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } =
        (await import('./vsOpenCodeXDestination')) as {
          notifyIfVsxAgentDestinationWithoutVsOpenCodeX: () => void;
        };
      notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
      vitest.expect(showInformationMessageMock).not.toHaveBeenCalled();
    });

    vitest.it('notifica una vez por sesión si destino es VSOpenCodeX y la extensión no está cargada', async () => {
      configGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'vsOpenCodeX' : fallback;
    });
      getExtensionMock.mockReturnValue();
      const { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } =
        (await import('./vsOpenCodeXDestination')) as {
          notifyIfVsxAgentDestinationWithoutVsOpenCodeX: () => void;
        };
      notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
      notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
      vitest.expect(showInformationMessageMock).toHaveBeenCalledTimes(1);
    });

    vitest.it('reinicia el aviso al volver a copilotChat y otra vez a VSOpenCodeX', async () => {
      const { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } =
        (await import('./vsOpenCodeXDestination')) as {
          notifyIfVsxAgentDestinationWithoutVsOpenCodeX: () => void;
        };
      configGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'vsOpenCodeX' : fallback;
    });
      notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
      configGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'copilotChat' : fallback;
    });
      notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
      configGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'vsOpenCodeX' : fallback;
    });
      notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
      vitest.expect(showInformationMessageMock).toHaveBeenCalledTimes(2);
    });

    vitest.it('no notifica si la extensión VSOpenCodeX está presente', async () => {
      configGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'vsOpenCodeX' : fallback;
    });
      getExtensionMock.mockReturnValue({ id: 'jaminsmoke.vsopencodex' });
      const { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } =
        (await import('./vsOpenCodeXDestination')) as {
          notifyIfVsxAgentDestinationWithoutVsOpenCodeX: () => void;
        };
      notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
      vitest.expect(showInformationMessageMock).not.toHaveBeenCalled();
    });
});
