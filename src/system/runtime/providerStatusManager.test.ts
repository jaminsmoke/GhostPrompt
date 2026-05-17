/**
 * @file Tests de ProviderStatusManager.
 */

import * as vitest from 'vitest';
import { vi } from 'vitest';

import { ProviderStatusManager } from './providerStatusManager';

import type { ProviderStatusModule } from '../internals/protocols/state/provider';

vitest.describe('ProviderStatusManager', () => {
  let manager: ProviderStatusManager;

  const runningModule: ProviderStatusModule = {
    id: 'copilot',
    label: 'Copilot LM',
    check: vi.fn().mockResolvedValue({
      id: 'copilot' as const,
      status: 'running' as const,
      label: 'Copilot LM',
      statusText: 'Running',
    }),
  };

  const stoppedModule: ProviderStatusModule = {
    id: 'opencode',
    label: 'OpenCode',
    check: vi.fn().mockResolvedValue({
      id: 'opencode' as const,
      status: 'stopped' as const,
      label: 'OpenCode',
      statusText: 'Stopped',
      actions: ['start' as const],
    }),
    start: vi.fn().mockResolvedValue(),
  };

  const errorModule: ProviderStatusModule = {
    id: 'ollama',
    label: 'Ollama',
    check: vi.fn().mockRejectedValue(new Error('fail')),
  };

  vitest.beforeEach(() => {
    manager = new ProviderStatusManager();
  });

  vitest.it('registra y lista módulos', () => {
    manager.register(runningModule);
    vitest.expect(manager.getAllModules()).toHaveLength(1);
    vitest.expect(manager.getModule('copilot')).toBeDefined();
  });

  vitest.it('refreshAll retorna estados de todos los módulos registrados', async () => {
    manager.register(runningModule);
    manager.register(stoppedModule);

    const states = await manager.refreshAll();

    vitest.expect(states).toHaveLength(2);
    vitest.expect(states[0].status).toBe('running');
    vitest.expect(states[1].status).toBe('stopped');
  });

  vitest.it('refreshAll captura errores y retorna estado error', async () => {
    manager.register(errorModule);

    const states = await manager.refreshAll();

    vitest.expect(states).toHaveLength(1);
    vitest.expect(states[0].status).toBe('error');
    vitest.expect(states[0].statusText).toBe('Error al comprobar estado');
  });

  vitest.it('refresh retorna estado de un módulo específico', async () => {
    manager.register(runningModule);

    const state = await manager.refresh('copilot');

    vitest.expect(state.status).toBe('running');
  });

  vitest.it('refresh lanza error si el módulo no existe', async () => {
    await vitest.expect(manager.refresh('no-existe')).rejects.toThrow('Proveedor "no-existe" no registrado');
  });

  vitest.it('start ejecuta start del módulo y refresca estado', async () => {
    manager.register(stoppedModule);

    const state = await manager.start('opencode');

    vitest.expect(stoppedModule.start).toHaveBeenCalledOnce();
    vitest.expect(state.status).toBe('stopped');
  });

  vitest.it('start lanza error si módulo no tiene start', async () => {
    manager.register(runningModule);

    await vitest.expect(manager.start('copilot')).rejects.toThrow('Proveedor "copilot" no soporta iniciar');
  });

  vitest.it('onDidChange se dispara tras refreshAll', async () => {
    manager.register(runningModule);
    const listener = vi.fn();
    manager.onDidChange(listener);

    await manager.refreshAll();

    vitest.expect(listener).toHaveBeenCalledOnce();
    vitest.expect(listener).toHaveBeenCalledWith(
      vitest.expect.arrayContaining([vitest.expect.objectContaining({ id: 'copilot' })]),
    );
  });

  vitest.it('dispose limpia listeners', () => {
    const listener = vi.fn();
    manager.onDidChange(listener);
    manager.dispose();

    vitest.expect(manager.getAllModules()).toHaveLength(0);
  });
});
