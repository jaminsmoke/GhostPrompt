/**
 * @file Tests del cliente SDK OpenCode (sesiones, health, prompt).
 */

import * as vitest from 'vitest';
import { vi } from 'vitest';

import { OPENCODE_DEFAULT_PORT } from '../../../../system/internals/protocols/types/typeOpencodeClient';

import type * as OpencodeClientModule from './index';
import type * as TypeOpencodeClientModule from '../../../../system/internals/protocols/types/typeOpencodeClient';

type OpenCodeSdkClient = TypeOpencodeClientModule.OpenCodeSdkClient;

const sessionCreateMock = vi.fn<Promise<unknown>, [unknown?]>();
const sessionPromptMock = vi.fn<Promise<unknown>, [unknown]>();
const sessionDeleteMock = vi.fn<Promise<unknown>, [unknown]>();
const configGetMock = vi.fn<Promise<unknown>, []>();
const eventSubscribeMock = vi.fn<Promise<{ stream: AsyncIterable<unknown> }>, [{ signal: AbortSignal }]>();

const fakeSdkClient: OpenCodeSdkClient = {
  config: { get: configGetMock },
  session: {
    create: sessionCreateMock,
    prompt: sessionPromptMock,
    delete: sessionDeleteMock,
  },
  event: { subscribe: eventSubscribeMock },
};

vi.mock('@opencode-ai/sdk', () => ({
  createOpencodeClient: vi.fn<OpenCodeSdkClient, [unknown]>(() => fakeSdkClient),
}));

vitest.afterEach(() => {
  vi.restoreAllMocks();
});

vitest.describe('opencode client', () => {
  vitest.it('OPENCODE_DEFAULT_PORT es 4096', async () => {
    const loadedModule = (await import(
      '../../../../system/internals/protocols/types/typeOpencodeClient'
    )) as typeof TypeOpencodeClientModule;
    vitest.expect(loadedModule.OPENCODE_DEFAULT_PORT).toBe(OPENCODE_DEFAULT_PORT);
  });

  vitest.it('createOpenCodeClient devuelve un cliente y lo almacena como global', async () => {
    const loadedModule = (await import('./index')) as typeof OpencodeClientModule;
    loadedModule.resetClient();
    const client = await loadedModule.createOpenCodeClient({});
    vitest.expect(client).toBe(fakeSdkClient);
    vitest.expect(loadedModule.getGlobalClient()).toBe(fakeSdkClient);
    loadedModule.resetClient();
  });

  vitest.it('healthCheck devuelve true si config.get resolves', async () => {
    const loadedModule = (await import('./index')) as typeof OpencodeClientModule;
    loadedModule.resetClient();
    await loadedModule.createOpenCodeClient({});
    configGetMock.mockResolvedValue({ data: { status: 'ok' } });
    const result = await loadedModule.healthCheck(loadedModule.getGlobalClient());
    vitest.expect(result).toBe(true);
    loadedModule.resetClient();
  });

  vitest.it('healthCheck devuelve false si config.get rechaza', async () => {
    const loadedModule = (await import('./index')) as typeof OpencodeClientModule;
    loadedModule.resetClient();
    await loadedModule.createOpenCodeClient({});
    configGetMock.mockRejectedValue(new Error('conn refused'));
    const result = await loadedModule.healthCheck(loadedModule.getGlobalClient());
    vitest.expect(result).toBe(false);
    loadedModule.resetClient();
  });

  vitest.it('getSession devuelve id de sesion', async () => {
    const loadedModule = (await import('./index')) as typeof OpencodeClientModule;
    loadedModule.resetClient();
    await loadedModule.createOpenCodeClient({});
    sessionCreateMock.mockResolvedValue({ data: { id: 'sess-xyz' } });
    const id = await loadedModule.getSession(loadedModule.getGlobalClient());
    vitest.expect(id).toBe('sess-xyz');
    loadedModule.resetClient();
  });

  vitest.it('promptOpenCode extrae texto de parts tipo text', async () => {
    const loadedModule = (await import('./index')) as typeof OpencodeClientModule;
    loadedModule.resetClient();
    await loadedModule.createOpenCodeClient({});
    sessionCreateMock.mockResolvedValue({ data: { id: 'sess-prompt' } });
    sessionPromptMock.mockResolvedValue({
      data: { parts: [{ type: 'text', text: 'respuesta completa' }] },
    });
    const id = await loadedModule.getSession(loadedModule.getGlobalClient());
    const text = await loadedModule.promptOpenCode(
      id,
      { providerID: 'test', modelID: 'm1' },
      [{ type: 'text', text: 'pr' }],
      loadedModule.getGlobalClient(),
    );
    vitest.expect(text).toBe('respuesta completa');
    loadedModule.resetClient();
  });

  vitest.it('getSession reutiliza sesion del pool (no crea otra)', async () => {
    const loadedModule = (await import('./index')) as typeof OpencodeClientModule;
    loadedModule.resetClient();
    await loadedModule.createOpenCodeClient({});
    sessionCreateMock.mockResolvedValue({ data: { id: 'pooled' } });
    const id1 = await loadedModule.getSession(loadedModule.getGlobalClient());
    const id2 = await loadedModule.getSession(loadedModule.getGlobalClient());
    vitest.expect(id1).toBe('pooled');
    vitest.expect(id2).toBe('pooled');
    vitest.expect(sessionCreateMock).toHaveBeenCalledTimes(1);
    loadedModule.resetClient();
  });

  vitest.it('closeAllSessions hace delete de cada sesion del pool', async () => {
    const loadedModule = (await import('./index')) as typeof OpencodeClientModule;
    loadedModule.resetClient();
    await loadedModule.createOpenCodeClient({});
    sessionCreateMock.mockResolvedValue({ data: { id: 'close-sess' } });
    await loadedModule.getSession(loadedModule.getGlobalClient());
    await loadedModule.closeAllSessions(loadedModule.getGlobalClient());
    vitest.expect(sessionDeleteMock).toHaveBeenCalled();
    loadedModule.resetClient();
  });

  vitest.it('resetClient deja getGlobalClient sin inicializar', async () => {
    const loadedModule = (await import('./index')) as typeof OpencodeClientModule;
    loadedModule.resetClient();
    await loadedModule.createOpenCodeClient({});
    loadedModule.resetClient();
    vitest.expect(() => loadedModule.getGlobalClient()).toThrow();
  });
});
