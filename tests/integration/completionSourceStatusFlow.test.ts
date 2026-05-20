/**
 * @file Tests de integración del flujo de estado de proveedores LM.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

const execMock = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ exec: execMock }));

vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => ({ get: vi.fn() }) },
}));

import { ProviderStatusManager } from '../../src/system/runtime/providers/providerStatusManager';

import type { ProviderStatusModule } from '../../src/system/internals/protocols/state/provider';

vitest.describe('providerStatus flow - integration', () => {
  let manager: ProviderStatusManager;

  const mockCopilot: ProviderStatusModule = {
    id: 'copilot',
    label: 'Copilot LM',
    check: vi.fn().mockResolvedValue({
      id: 'copilot' as const,
      status: 'running' as const,
      label: 'Copilot LM',
      statusText: 'Running',
      actions: ['stop' as const],
    }),
    start: vi.fn().mockResolvedValue(),
    stop: vi.fn().mockResolvedValue(),
  };

  const mockOllama: ProviderStatusModule = {
    id: 'ollama',
    label: 'Ollama',
    check: vi.fn().mockResolvedValue({
      id: 'ollama' as const,
      status: 'unavailable' as const,
      label: 'Ollama',
      statusText: 'Not available',
    }),
  };

  vitest.beforeEach(() => {
    manager = new ProviderStatusManager();
    vi.clearAllMocks();
  });

  vitest.it('refreshAll captura errores de módulos individuales', async () => {
    manager.register({
      ...mockCopilot,
      check: vi.fn().mockRejectedValue(new Error('connection failed')),
    });

    const result = await manager.refreshAll();

    vitest.expect(result).toHaveLength(1);
    vitest.expect(result[0].status).toBe('error');
    vitest.expect(result[0].statusText).toBe('Error al comprobar estado');
  });

  vitest.it('start ejecuta start del módulo y refresca estado', async () => {
    manager.register(mockCopilot);

    const state = await manager.start('copilot');

    vitest.expect(mockCopilot.start).toHaveBeenCalledOnce();
    vitest.expect(state.status).toBe('running');
  });

  vitest.it('stop ejecuta stop del módulo y refresca estado', async () => {
    const stopFunction = vi.fn().mockResolvedValue();
    manager.register({ ...mockCopilot, stop: stopFunction });

    const state = await manager.stop('copilot');

    vitest.expect(stopFunction).toHaveBeenCalledOnce();
    vitest.expect(state.status).toBe('running');
  });

  vitest.it('refreshAll retorna estados de todas las fuentes registradas', async () => {
    manager.register(mockCopilot);
    manager.register(mockOllama);

    const result = await manager.refreshAll();

    vitest.expect(result).toHaveLength(2);
    vitest.expect(result[0].status).toBe('running');
    vitest.expect(result[1].status).toBe('unavailable');
  });
});
