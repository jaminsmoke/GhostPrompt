/**
 * @file Pruebas del gestor de modelos Ollama.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

const { execMock, spawnMock } = vi.hoisted(() => ({
  execMock: vi.fn(),
  spawnMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  exec: execMock,
  spawn: spawnMock,
}));

import { ollamaModelManager } from './ollamaModelManager';

import type { ChildProcess } from 'node:child_process';

type ChildProcessEvents = {
  stdout: Map<string, (data: Buffer) => void>;
  stderr: Map<string, (data: Buffer) => void>;
  events: Map<string, (value: unknown) => void>;
};

/**
 * Creates a fake child process with controllable stdout/stderr and lifecycle events.
 * @returns {{ proc: unknown; events: ChildProcessEvents }} A mocked process and its event handlers for test assertions.
 */
function createFakeProcess(): { proc: ChildProcess; events: ChildProcessEvents } {
  const events: ChildProcessEvents = {
    stdout: new Map<string, (data: Buffer) => void>(),
    stderr: new Map<string, (data: Buffer) => void>(),
    events: new Map<string, (value: unknown) => void>(),
  };

  const proc = {
    stdout: {
      on(event: string, callback: (data: Buffer) => void) {
        events.stdout.set(event, callback);
        return {
          dispose: () => {},
        };
      },
    },
    stderr: {
      on(event: string, callback: (data: Buffer) => void) {
        events.stderr.set(event, callback);
        return {
          dispose: () => {},
        };
      },
    },
    on(event: string, callback: (value: unknown) => void) {
      events.events.set(event, callback);
      return {
        dispose: () => {},
      };
    },
    kill: vi.fn(() => {
      (proc as unknown as { killed: boolean }).killed = true;
    }),
    killed: false,
  } as unknown as ChildProcess;

  return { proc, events };
}

vitest.describe('OllamaModelManager', () => {
  vitest.beforeEach(() => {
    vi.clearAllMocks();
  });

  vitest.afterEach(() => {
    ollamaModelManager.dispose();
  });

  vitest.it('checkInstallation resolves and sets ready state on success', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        options: { timeout?: number },
        callback: (error: Error | undefined, stdout: string, stderr: string) => void,
      ) => {
        callback(undefined, 'ollama 1.0.0', '');
        return {} as ChildProcess;
      },
    );

    const version = await ollamaModelManager.checkInstallation();

    vitest.expect(version).toBe('ollama 1.0.0');
    vitest.expect(ollamaModelManager.state).toBe('ready');
  });

  vitest.it('checkInstallation rejects and sets error state when ollama is not installed', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        options: { timeout?: number },
        callback: (error: Error | undefined, stdout: string, stderr: string) => void,
      ) => {
        callback(new Error('Not found'), '', 'ollama: command not found');
        return {} as ChildProcess;
      },
    );

    await vitest.expect(ollamaModelManager.checkInstallation()).rejects.toThrow('Ollama not installed');
    vitest.expect(ollamaModelManager.state).toBe('error');
  });

  vitest.it('listInstalledModels parses model names from ollama list output', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        options: { timeout?: number },
        callback: (error: Error | undefined, stdout: string, stderr: string) => void,
      ) => {
        callback(undefined, 'NAME\nmodel-a 100\nmodel-b 200\n', '');
        return {} as ChildProcess;
      },
    );

    const models = await ollamaModelManager.listInstalledModels();

    vitest.expect(models).toEqual(['model-a', 'model-b']);
    vitest.expect(ollamaModelManager.state).toBe('ready');
  });

  vitest.it('listInstalledModels returns empty array and error state when list fails', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        options: { timeout?: number },
        callback: (error: Error | undefined, stdout: string, stderr: string) => void,
      ) => {
        callback(new Error('Command failed'), '', '');
        return {} as ChildProcess;
      },
    );

    const models = await ollamaModelManager.listInstalledModels();

    vitest.expect(models).toEqual([]);
    vitest.expect(ollamaModelManager.state).toBe('error');
  });

  vitest.it('ps returns the active model name from ollama ps output', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        options: { timeout?: number },
        callback: (error: Error | undefined, stdout: string, stderr: string) => void,
      ) => {
        callback(undefined, 'NAME\nmodel-a running\n', '');
        return {} as ChildProcess;
      },
    );

    const active = await ollamaModelManager.ps();

    vitest.expect(active).toBe('model-a');
  });

  vitest.it('ps returns undefined when ollama ps fails', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        options: { timeout?: number },
        callback: (error: Error | undefined, stdout: string, stderr: string) => void,
      ) => {
        callback(new Error('failed'), '', '');
        return {} as ChildProcess;
      },
    );

    const active = await ollamaModelManager.ps();

    vitest.expect(active).toBeUndefined();
  });

  vitest.it('stopModel calls ollama stop for the target model and resets state', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        options: { timeout?: number },
        callback: (error: Error | undefined, stdout: string, stderr: string) => void,
      ) => {
        callback(undefined, '', '');
        return {} as ChildProcess;
      },
    );

    await ollamaModelManager.stopModel('model-a');

    vitest.expect(execMock).toHaveBeenCalledWith('ollama stop model-a', vitest.expect.anything(), vitest.expect.any(Function));
    vitest.expect(ollamaModelManager.state).toBe('idle');
  });

  vitest.it('startModel resolves when stdout emits a ready indicator', async () => {
    const { proc, events } = createFakeProcess();
    spawnMock.mockReturnValue(proc);

    const modelPromise = ollamaModelManager.startModel('model-a');
    events.stdout.get('data')?.(Buffer.from('loaded\n'));

    await vitest.expect(modelPromise).resolves.toBeUndefined();
    vitest.expect(ollamaModelManager.state).toBe('ready-model');
  });

  vitest.it('startModel rejects when stderr emits a failure message', async () => {
    const { proc, events } = createFakeProcess();
    spawnMock.mockReturnValue(proc);

    const modelPromise = ollamaModelManager.startModel('model-b');
    events.stderr.get('data')?.(Buffer.from('error failed to start\n'));

    await vitest.expect(modelPromise).rejects.toThrow('error failed to start');
    vitest.expect(ollamaModelManager.state).toBe('error');
  });
});
