import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderStatusManager } from '../src/system/status/ProviderStatusManager';
import type { ProviderStatusModule } from '../src/system/status/types';

describe('ProviderStatusManager', () => {
  let manager: ProviderStatusManager;
  const runningModule: ProviderStatusModule = {
    id: 'test-engine',
    kind: 'engine',
    label: 'Test Engine',
    check: vi.fn().mockResolvedValue({
      id: 'test-engine',
      kind: 'engine' as const,
      status: 'running' as const,
      label: 'Test Engine',
      statusText: 'Running',
    }),
  };

  const stoppedModule: ProviderStatusModule = {
    id: 'test-dest',
    kind: 'destination',
    label: 'Test Dest',
    check: vi.fn().mockResolvedValue({
      id: 'test-dest',
      kind: 'destination' as const,
      status: 'stopped' as const,
      label: 'Test Dest',
      statusText: 'Stopped',
      actions: ['start' as const],
    }),
    start: vi.fn().mockResolvedValue(undefined),
  };

  const errorModule: ProviderStatusModule = {
    id: 'error-mod',
    kind: 'engine',
    label: 'Error Mod',
    check: vi.fn().mockRejectedValue(new Error('fail')),
  };

  beforeEach(() => {
    manager = new ProviderStatusManager();
  });

  it('registra y lista módulos', () => {
    manager.register(runningModule);
    expect(manager.getAllModules()).toHaveLength(1);
    expect(manager.getModule('test-engine')).toBeDefined();
  });

  it('refreshAll retorna estados de todos los módulos registrados', async () => {
    manager.register(runningModule);
    manager.register(stoppedModule);

    const states = await manager.refreshAll();

    expect(states).toHaveLength(2);
    expect(states[0].status).toBe('running');
    expect(states[1].status).toBe('stopped');
  });

  it('refreshAll captura errores y retorna estado error', async () => {
    manager.register(errorModule);

    const states = await manager.refreshAll();

    expect(states).toHaveLength(1);
    expect(states[0].status).toBe('error');
    expect(states[0].statusText).toBe('Error al comprobar estado');
  });

  it('refresh retorna estado de un módulo específico', async () => {
    manager.register(runningModule);

    const state = await manager.refresh('test-engine');

    expect(state.status).toBe('running');
  });

  it('refresh lanza error si el módulo no existe', async () => {
    await expect(manager.refresh('no-existe')).rejects.toThrow(
      'Provider "no-existe" no registrado',
    );
  });

  it('start ejecuta start del módulo y refresca estado', async () => {
    manager.register(stoppedModule);

    const state = await manager.start('test-dest');

    expect(stoppedModule.start).toHaveBeenCalledOnce();
    expect(state.status).toBe('stopped');
  });

  it('start lanza error si módulo no tiene start', async () => {
    manager.register(runningModule);

    await expect(manager.start('test-engine')).rejects.toThrow(
      'Provider "test-engine" no soporta iniciar',
    );
  });

  it('onDidChange se dispara tras refreshAll', async () => {
    manager.register(runningModule);
    const listener = vi.fn();
    manager.onDidChange(listener);

    await manager.refreshAll();

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'test-engine' })]),
    );
  });

  it('dispose limpia listeners', () => {
    const listener = vi.fn();
    manager.onDidChange(listener);
    manager.dispose();

    expect(manager.getAllModules()).toHaveLength(0);
  });
});
