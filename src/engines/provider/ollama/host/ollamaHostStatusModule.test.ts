/**
 * @file Pruebas del módulo de estado host Ollama.
 */

import * as vitest from 'vitest';
import { vi } from 'vitest';

const execMock = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ exec: execMock }));

const configGetMock = vi.hoisted(() => vi.fn());
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({ get: configGetMock }),
  },
}));

import { ollamaStatusModule } from './ollamaHostStatusModule';

vitest.describe('ollamaStatusModule', () => {
  vitest.beforeEach(() => {
    vi.clearAllMocks();
  });

  vitest.it('retorna unavailable si ollama --version falla', async () => {
    execMock.mockImplementationOnce(
      (_cmd: string, _options: unknown, callback: (error: Error | undefined, stdout: string, stderr: string) => void) => {
        callback(new Error('not found'), '', 'command not found');
      },
    );

    const state = await ollamaStatusModule.check();
    vitest.expect(state.status).toBe('unavailable');
    vitest.expect(state.statusText).toBe('No instalado');
  });

  vitest.it('retorna stopped si hay modelos pero ninguno activo', async () => {
    execMock
      .mockImplementationOnce(
        (_cmd: string, _options: unknown, callback: (error: Error | undefined, stdout: string, stderr: string) => void) => {
          callback(undefined, 'ollama version 0.5.0', '');
        },
      )
      .mockImplementationOnce(
        (_cmd: string, _options: unknown, callback: (error: Error | undefined, stdout: string, stderr: string) => void) => {
          callback(
            undefined,
            'NAME\tID\tSIZE\tMODIFIED\nmistral:latest\tabc123\t4.2GB\t2 days ago\nllama3:latest\tdef456\t6.1GB\t1 day ago\n',
            '',
          );
        },
      )
      .mockImplementationOnce(
        (_cmd: string, _options: unknown, callback: (error: Error | undefined, stdout: string, stderr: string) => void) => {
          callback(undefined, 'NAME\tID\tSIZE\tMODIFIED\n', '');
        },
      );

    const state = await ollamaStatusModule.check();
    vitest.expect(state.status).toBe('stopped');
    vitest.expect(state.statusText).toBe('2 modelos disponibles');
    vitest.expect(state.actions).toHaveLength(0);
  });

  vitest.it('retorna running si hay un modelo activo en ollama ps', async () => {
    execMock
      .mockImplementationOnce(
        (_cmd: string, _options: unknown, callback: (error: Error | undefined, stdout: string, stderr: string) => void) => {
          callback(undefined, 'ollama version 0.5.0', '');
        },
      )
      .mockImplementationOnce(
        (_cmd: string, _options: unknown, callback: (error: Error | undefined, stdout: string, stderr: string) => void) => {
        callback(undefined, 'NAME\tID\tSIZE\tMODIFIED\nmistral:latest\tabc123\t4.2GB\t2 days ago\n', '');
      })
      .mockImplementationOnce((_cmd: string, _options: unknown, callback: (error: Error | undefined, stdout: string, stderr: string) => void) => {
        callback(undefined, 'NAME\tID\tCPU\tMEMORY\nmistral:latest\tabc123\t0.1%\t1.2GB/8GB\n', '');
      });

    const state = await ollamaStatusModule.check();
    vitest.expect(state.status).toBe('running');
    vitest.expect(state.statusText).toBe('mistral:latest activo');
    vitest.expect(state.actions).toContain('stop');
  });

  vitest.it('retorna stopped si no hay modelos instalados', async () => {
    execMock
      .mockImplementationOnce((_cmd: string, _options: unknown, callback: (error: Error | undefined, stdout: string, stderr: string) => void) => {
        callback(undefined, 'ollama version 0.5.0', '');
      })
      .mockImplementationOnce((_cmd: string, _options: unknown, callback: (error: Error | undefined, stdout: string, stderr: string) => void) => {
        callback(undefined, 'NAME\tID\tSIZE\tMODIFIED\n', '');
      });

    const state = await ollamaStatusModule.check();
    vitest.expect(state.status).toBe('stopped');
    vitest.expect(state.statusText).toContain('sin modelos');
  });
});
