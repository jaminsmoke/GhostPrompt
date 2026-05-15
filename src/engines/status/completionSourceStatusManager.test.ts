/**
 * @file Tests de CompletionSourceStatusManager.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompletionSourceStatusManager } from './completionSourceStatusManager';

import type { CompletionSourceStatusModule } from './completionSourceStatusTypes';

describe('CompletionSourceStatusManager', () => {
  let manager: CompletionSourceStatusManager;

  const runningModule: CompletionSourceStatusModule = {
    id: 'copilot',
    label: 'Copilot LM',
    check: vi.fn().mockResolvedValue({
      id: 'copilot' as const,
      status: 'running' as const,
      label: 'Copilot LM',
      statusText: 'Running',
    }),
  };

  const stoppedModule: CompletionSourceStatusModule = {
    id: 'opencode',
    label: 'OpenCode',
    check: vi.fn().mockResolvedValue({
      id: 'opencode' as const,
      status: 'stopped' as const,
      label: 'OpenCode',
      statusText: 'Stopped',
      actions: ['start' as const],
    }),
    start: vi.fn().mockResolvedValue(undefined),
  };

  const errorModule: CompletionSourceStatusModule = {
    id: 'ollama',
    label: 'Ollama',
    check: vi.fn().mockRejectedValue(new Error('fail')),
  };

  beforeEach(() => {
    manager = new CompletionSourceStatusManager();
  });

  it('registra y lista módulos', () => {
    manager.register(runningModule);
    expect(manager.getAllModules()).toHaveLength(1);
    expect(manager.getModule('copilot')).toBeDefined();
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

    const state = await manager.refresh('copilot');

    expect(state.status).toBe('running');
  });

  it('refresh lanza error si el módulo no existe', async () => {
    await expect(manager.refresh('no-existe')).rejects.toThrow(
      'Fuente de completado "no-existe" no registrada',
    );
  });

  it('start ejecuta start del módulo y refresca estado', async () => {
    manager.register(stoppedModule);

    const state = await manager.start('opencode');

    expect(stoppedModule.start).toHaveBeenCalledOnce();
    expect(state.status).toBe('stopped');
  });

  it('start lanza error si módulo no tiene start', async () => {
    manager.register(runningModule);

    await expect(manager.start('copilot')).rejects.toThrow(
      'Fuente de completado "copilot" no soporta iniciar',
    );
  });

  it('onDidChange se dispara tras refreshAll', async () => {
    manager.register(runningModule);
    const listener = vi.fn();
    manager.onDidChange(listener);

    await manager.refreshAll();

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'copilot' })]),
    );
  });

  it('dispose limpia listeners', () => {
    const listener = vi.fn();
    manager.onDidChange(listener);
    manager.dispose();

    expect(manager.getAllModules()).toHaveLength(0);
  });
});
