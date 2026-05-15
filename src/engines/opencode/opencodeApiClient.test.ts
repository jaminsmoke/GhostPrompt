/**
 * @file Tests del cliente OpenCode (sesiones, health, prompt y stream).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OpenCodeSdkClient } from './opencodeApiClient';

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('opencodeApiClient', () => {
  it('OPENCODE_DEFAULT_PORT es 4096', async () => {
    const mod = (await import('./opencodeApiClient')) as typeof import('./opencodeApiClient');
    expect(mod.OPENCODE_DEFAULT_PORT).toBe(4096);
  });

  it('createOpenCodeClient devuelve un cliente y lo almacena como global', async () => {
    const mod = (await import('./opencodeApiClient')) as typeof import('./opencodeApiClient');
    mod.resetClient();
    const client = await mod.createOpenCodeClient({});
    expect(client).toBe(fakeSdkClient);
    expect(mod.getGlobalClient()).toBe(fakeSdkClient);
    mod.resetClient();
  });

  it('healthCheck devuelve true si config.get resolves', async () => {
    const mod = (await import('./opencodeApiClient')) as typeof import('./opencodeApiClient');
    mod.resetClient();
    await mod.createOpenCodeClient({});
    configGetMock.mockResolvedValue({ data: { status: 'ok' } });
    const result = await mod.healthCheck(mod.getGlobalClient());
    expect(result).toBe(true);
    mod.resetClient();
  });

  it('healthCheck devuelve false si config.get rechaza', async () => {
    const mod = (await import('./opencodeApiClient')) as typeof import('./opencodeApiClient');
    mod.resetClient();
    await mod.createOpenCodeClient({});
    configGetMock.mockRejectedValue(new Error('conn refused'));
    const result = await mod.healthCheck(mod.getGlobalClient());
    expect(result).toBe(false);
    mod.resetClient();
  });

  it('createSessionInternal devuelve id de sesion', async () => {
    const mod = (await import('./opencodeApiClient')) as typeof import('./opencodeApiClient');
    mod.resetClient();
    await mod.createOpenCodeClient({});
    sessionCreateMock.mockResolvedValue({ data: { id: 'sess-xyz' } });
    const id = await mod.getSession(mod.getGlobalClient());
    expect(id).toBe('sess-xyz');
    mod.resetClient();
  });

  it('promptOpenCode extrae texto de parts tipo text', async () => {
    const mod = (await import('./opencodeApiClient')) as typeof import('./opencodeApiClient');
    mod.resetClient();
    await mod.createOpenCodeClient({});
    sessionCreateMock.mockResolvedValue({ data: { id: 'sess-prompt' } });
    sessionPromptMock.mockResolvedValue({
      data: { parts: [{ type: 'text', text: 'respuesta completa' }] },
    });
    const id = await mod.getSession(mod.getGlobalClient());
    const text = await mod.promptOpenCode(
      id,
      { providerID: 'test', modelID: 'm1' },
      [{ type: 'text', text: 'pr' }],
      mod.getGlobalClient(),
    );
    expect(text).toBe('respuesta completa');
    mod.resetClient();
  });

  it('getSession reutiliza sesion del pool (no crea otra)', async () => {
    const mod = (await import('./opencodeApiClient')) as typeof import('./opencodeApiClient');
    mod.resetClient();
    await mod.createOpenCodeClient({});
    sessionCreateMock.mockResolvedValue({ data: { id: 'pooled' } });
    const id1 = await mod.getSession(mod.getGlobalClient());
    const id2 = await mod.getSession(mod.getGlobalClient());
    expect(id1).toBe('pooled');
    expect(id2).toBe('pooled');
    expect(sessionCreateMock).toHaveBeenCalledTimes(1);
    mod.resetClient();
  });

  it('closeAllSessions hace delete de cada sesion del pool', async () => {
    const mod = (await import('./opencodeApiClient')) as typeof import('./opencodeApiClient');
    mod.resetClient();
    await mod.createOpenCodeClient({});
    sessionCreateMock.mockResolvedValue({ data: { id: 'close-sess' } });
    await mod.getSession(mod.getGlobalClient());
    await mod.closeAllSessions(mod.getGlobalClient());
    expect(sessionDeleteMock).toHaveBeenCalled();
    mod.resetClient();
  });

  it('resetClient deja getGlobalClient sin inicializar', async () => {
    const mod = (await import('./opencodeApiClient')) as typeof import('./opencodeApiClient');
    mod.resetClient();
    await mod.createOpenCodeClient({});
    mod.resetClient();
    expect(() => mod.getGlobalClient()).toThrow();
  });
});
