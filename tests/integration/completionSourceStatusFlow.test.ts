/**
 * @file Tests de integración del flujo de estado de fuentes de completado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const execMock = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ exec: execMock }));

vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => ({ get: vi.fn() }) },
}));

import { CompletionSourceStatusManager } from '../../src/engines/status/completionSourceStatusManager';

import type { CompletionSourceStatusModule } from '../../src/engines/status/completionSourceStatusTypes';

describe('completionSourceStatus flow - integration', () => {
  let manager: CompletionSourceStatusManager;

  const mockCopilot: CompletionSourceStatusModule = {
    id: 'copilot',
    label: 'Copilot LM',
    check: vi.fn().mockResolvedValue({
      id: 'copilot' as const,
      status: 'running' as const,
      label: 'Copilot LM',
      statusText: 'Running',
      actions: ['stop' as const],
    }),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  };

  const mockOllama: CompletionSourceStatusModule = {
    id: 'ollama',
    label: 'Ollama',
    check: vi.fn().mockResolvedValue({
      id: 'ollama' as const,
      status: 'unavailable' as const,
      label: 'Ollama',
      statusText: 'Not available',
    }),
  };

  beforeEach(() => {
    manager = new CompletionSourceStatusManager();
    vi.clearAllMocks();
  });

  it('refreshAll captura errores de módulos individuales', async () => {
    manager.register({
      ...mockCopilot,
      check: vi.fn().mockRejectedValue(new Error('connection failed')),
    });

    const result = await manager.refreshAll();

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('error');
    expect(result[0].statusText).toBe('Error al comprobar estado');
  });

  it('start ejecuta start del módulo y refresca estado', async () => {
    manager.register(mockCopilot);

    const state = await manager.start('copilot');

    expect(mockCopilot.start).toHaveBeenCalledOnce();
    expect(state.status).toBe('running');
  });

  it('stop ejecuta stop del módulo y refresca estado', async () => {
    const stopFn = vi.fn().mockResolvedValue(undefined);
    manager.register({ ...mockCopilot, stop: stopFn });

    const state = await manager.stop('copilot');

    expect(stopFn).toHaveBeenCalledOnce();
    expect(state.status).toBe('running');
  });

  it('refreshAll retorna estados de todas las fuentes registradas', async () => {
    manager.register(mockCopilot);
    manager.register(mockOllama);

    const result = await manager.refreshAll();

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('running');
    expect(result[1].status).toBe('unavailable');
  });
});
