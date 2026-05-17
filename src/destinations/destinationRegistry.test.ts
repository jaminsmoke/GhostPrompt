/**
 * @file Pruebas unitarias del registro de destinos GhostPrompt.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

import type * as DestinationRegistryModule from './destinationRegistry';

const configGetMock = vi.hoisted(() => vi.fn());
const getExtensionMock = vi.hoisted(() => vi.fn());

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
}));

type TestModule = typeof DestinationRegistryModule;
let loadedModule: TestModule;

vitest.beforeEach(async () => {
  vi.clearAllMocks();
  configGetMock.mockReturnValue('copilotChat');
  getExtensionMock.mockReturnValue();
  loadedModule = (await import('./destinationRegistry')) as TestModule;
});

vitest.describe('destinationRegistry', () => {
  vitest.describe('registerDestination / getDestinationProviderForId', () => {
    vitest.it('registra y resuelve un provider por id', () => {
      loadedModule.registerDestination({ id: 'copilotChat', sendPrompt: vi.fn() });

      const found = loadedModule.getDestinationProviderForId('copilotChat');
      vitest.expect(found).toBeDefined();
      if (!found) {
        throw new Error('Expected provider to be registered');
      }
      vitest.expect(found.id).toBe('copilotChat');
      vitest.expect(found.sendPrompt).toBeDefined();
    });

    vitest.it('devuelve undefined si no hay provider registrado', () => {
      const found = loadedModule.getDestinationProviderForId('vsOpenCodeX');
      vitest.expect(found).toBeUndefined();
    });
  });

  vitest.describe('getActiveDestinationProvider', () => {
    vitest.it('devuelve provider registrado si existe', () => {
      const sendPrompt = vi.fn<Promise<void>, [string]>();
      loadedModule.registerDestination({ id: 'copilotChat', sendPrompt });

      const active = loadedModule.getActiveDestinationProvider();
      vitest.expect(active.id).toBe('copilotChat');
      vitest.expect(active.sendPrompt).toBe(sendPrompt);
    });

    vitest.it('devuelve provider cursorChat cuando está registrado y configurado', async () => {
      await import('./cursor/cursorChatDestination');
      configGetMock.mockReturnValue('cursorChat');
      const active = loadedModule.getActiveDestinationProvider();
      vitest.expect(active.id).toBe('cursorChat');
      vitest.expect(active.sendPrompt).toBeDefined();
    });

    vitest.it('devuelve fallback con sendPrompt vacío si no hay provider para el destino activo', () => {
      configGetMock.mockReturnValue('vsOpenCodeX');
      const active = loadedModule.getActiveDestinationProvider();
      vitest.expect(active.id).toBe('vsOpenCodeX');
      vitest.expect(active.sendPrompt).toBeDefined();
    });

    vitest.it('lanza error al invocar sendPrompt de fallback no registrado', async () => {
      configGetMock.mockReturnValue('vsOpenCodeX');
      const active = loadedModule.getActiveDestinationProvider();
      await vitest.expect(active.sendPrompt('hola')).rejects.toThrow(
        "Destination provider 'vsOpenCodeX' no está registrado",
      );
    });
  });

  vitest.describe('getAgentDestination', () => {
    vitest.it('retorna copilotChat por defecto sin VSX instalada', () => {
      configGetMock.mockReturnValue('copilotChat');
      getExtensionMock.mockReturnValue();
      vitest.expect(loadedModule.getAgentDestination()).toBe('copilotChat');
    });

    vitest.it('retorna vsOpenCodeX si está configurado explícitamente', () => {
      configGetMock.mockReturnValue('vsOpenCodeX');
      vitest.expect(loadedModule.getAgentDestination()).toBe('vsOpenCodeX');
    });

    vitest.it('retorna cursorChat si está configurado explícitamente', () => {
      configGetMock.mockReturnValue('cursorChat');
      vitest.expect(loadedModule.getAgentDestination()).toBe('cursorChat');
    });
  });

  vitest.describe('parseAgentDestination', () => {
    vitest.it('normaliza valores conocidos y desconocidos', () => {
      vitest.expect(loadedModule.parseAgentDestination('vsOpenCodeX')).toBe('vsOpenCodeX');
      vitest.expect(loadedModule.parseAgentDestination('cursorChat')).toBe('cursorChat');
      vitest.expect(loadedModule.parseAgentDestination('copilotChat')).toBe('copilotChat');
      vitest.expect(loadedModule.parseAgentDestination('other')).toBe('copilotChat');
      vitest.expect(loadedModule.parseAgentDestination()).toBe('copilotChat');
    });
  });

  vitest.describe('isVsOpenCodeXExtensionInstalled', () => {
    vitest.it('retorna true si getExtension devuelve algo truthy', () => {
      getExtensionMock.mockReturnValue({ id: 'jaminsmoke.vsopencodex' });
      vitest.expect(loadedModule.isVsOpenCodeXExtensionInstalled()).toBe(true);
    });

    vitest.it('retorna false si getExtension devuelve undefined', () => {
      getExtensionMock.mockReturnValue();
      vitest.expect(loadedModule.isVsOpenCodeXExtensionInstalled()).toBe(false);
    });
  });
});
