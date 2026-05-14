import { beforeEach, describe, expect, it, vi } from 'vitest';

const execMock = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ exec: execMock }));

vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => ({ get: vi.fn() }) },
}));

import { ProviderStatusManager } from '../../src/system/status/ProviderStatusManager';
import type { ProviderStatusModule } from '../../src/system/status/types';

describe('providerStatus flow - integration', () => {
  let manager: ProviderStatusManager;

  const mockEngine: ProviderStatusModule = {
    id: 'test-engine',
    kind: 'engine',
    label: 'Test',
    check: vi.fn().mockResolvedValue({
      id: 'test-engine',
      kind: 'engine' as const,
      status: 'running' as const,
      label: 'Test',
      statusText: 'Running',
      actions: ['stop' as const],
    }),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  };

  const mockDest: ProviderStatusModule = {
    id: 'test-dest',
    kind: 'destination',
    label: 'Test Dest',
    check: vi.fn().mockResolvedValue({
      id: 'test-dest',
      kind: 'destination' as const,
      status: 'unavailable' as const,
      label: 'Test Dest',
      statusText: 'Not available',
    }),
  };

  beforeEach(() => {
    manager = new ProviderStatusManager();
    vi.clearAllMocks();
  });

  it('refreshAll captura errores de módulos individuales', async () => {
    manager.register({
      ...mockEngine,
      check: vi.fn().mockRejectedValue(new Error('connection failed')),
    });

    const result = await manager.refreshAll();

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('error');
    expect(result[0].statusText).toBe('Error al comprobar estado');
  });

  it('start ejecuta start del módulo y refresca estado', async () => {
    manager.register(mockEngine);

    const state = await manager.start('test-engine');

    expect(mockEngine.start).toHaveBeenCalledOnce();
    expect(state.status).toBe('running');
  });

  it('stop ejecuta stop del módulo y refresca estado', async () => {
    const stopFn = vi.fn().mockResolvedValue(undefined);
    manager.register({ ...mockEngine, stop: stopFn });

    const state = await manager.stop('test-engine');

    expect(stopFn).toHaveBeenCalledOnce();
    expect(state.status).toBe('running');
  });

  it('filtra providers por kind (engine vs destination)', async () => {
    manager.register(mockEngine);
    manager.register(mockDest);

    const engines = manager.getAllModules().filter((m) => m.kind === 'engine');
    const destinations = manager.getAllModules().filter((m) => m.kind === 'destination');

    expect(engines).toHaveLength(1);
    expect(destinations).toHaveLength(1);
    expect(engines[0].id).toBe('test-engine');
    expect(destinations[0].id).toBe('test-dest');
  });

  it('refreshAll retorna estados de todos los módulos registrados', async () => {
    manager.register(mockEngine);
    manager.register(mockDest);

    const result = await manager.refreshAll();

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('running');
    expect(result[1].status).toBe('unavailable');
  });
});
