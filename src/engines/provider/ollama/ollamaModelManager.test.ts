/**
 * @file Pruebas del gestor de modelos Ollama.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
        return { dispose: () => {} };
      },
    },
    stderr: {
      on(event: string, callback: (data: Buffer) => void) {
        events.stderr.set(event, callback);
        return { dispose: () => {} };
      },
    },
    on(event: string, callback: (value: unknown) => void) {
      events.events.set(event, callback);
      return { dispose: () => {} };
    },
    kill: vi.fn(() => {
      (proc as unknown as { killed: boolean }).killed = true;
    }),
    killed: false,
  } as unknown as ChildProcess;

  return { proc, events };
}

describe('OllamaModelManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    ollamaModelManager.dispose();
  });

  it('checkInstallation resolves and sets ready state on success', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        options: { timeout?: number },
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(null, 'ollama 1.0.0', '');
        return {} as ChildProcess;
      },
    );

    const version = await ollamaModelManager.checkInstallation();

    expect(version).toBe('ollama 1.0.0');
    expect(ollamaModelManager.state).toBe('ready');
  });

  it('checkInstallation rejects and sets error state when ollama is not installed', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        options: { timeout?: number },
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(new Error('Not found'), '', 'ollama: command not found');
        return {} as ChildProcess;
      },
    );

    await expect(ollamaModelManager.checkInstallation()).rejects.toThrow('Ollama not installed');
    expect(ollamaModelManager.state).toBe('error');
  });

  it('listInstalledModels parses model names from ollama list output', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        options: { timeout?: number },
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(null, 'NAME\nmodel-a 100\nmodel-b 200\n', '');
        return {} as ChildProcess;
      },
    );

    const models = await ollamaModelManager.listInstalledModels();

    expect(models).toEqual(['model-a', 'model-b']);
    expect(ollamaModelManager.state).toBe('ready');
  });

  it('listInstalledModels returns empty array and error state when list fails', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        options: { timeout?: number },
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(new Error('Command failed'), '', '');
        return {} as ChildProcess;
      },
    );

    const models = await ollamaModelManager.listInstalledModels();

    expect(models).toEqual([]);
    expect(ollamaModelManager.state).toBe('error');
  });

  it('ps returns the active model name from ollama ps output', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        options: { timeout?: number },
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(null, 'NAME\nmodel-a running\n', '');
        return {} as ChildProcess;
      },
    );

    const active = await ollamaModelManager.ps();

    expect(active).toBe('model-a');
  });

  it('ps returns null when ollama ps fails', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        options: { timeout?: number },
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(new Error('failed'), '', '');
        return {} as ChildProcess;
      },
    );

    const active = await ollamaModelManager.ps();

    expect(active).toBeNull();
  });

  it('stopModel calls ollama stop for the target model and resets state', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        options: { timeout?: number },
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(null, '', '');
        return {} as ChildProcess;
      },
    );

    await ollamaModelManager.stopModel('model-a');

    expect(execMock).toHaveBeenCalledWith('ollama stop model-a', expect.anything(), expect.any(Function));
    expect(ollamaModelManager.state).toBe('idle');
  });

  it('startModel resolves when stdout emits a ready indicator', async () => {
    const { proc, events } = createFakeProcess();
    spawnMock.mockReturnValue(proc);

    const modelPromise = ollamaModelManager.startModel('model-a');
    events.stdout.get('data')?.(Buffer.from('loaded\n'));

    await expect(modelPromise).resolves.toBeUndefined();
    expect(ollamaModelManager.state).toBe('ready-model');
  });

  it('startModel rejects when stderr emits a failure message', async () => {
    const { proc, events } = createFakeProcess();
    spawnMock.mockReturnValue(proc);

    const modelPromise = ollamaModelManager.startModel('model-b');
    events.stderr.get('data')?.(Buffer.from('error failed to start\n'));

    await expect(modelPromise).rejects.toThrow('error failed to start');
    expect(ollamaModelManager.state).toBe('error');
  });
});
