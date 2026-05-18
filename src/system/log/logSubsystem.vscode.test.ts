/**
 * @file Tests del subsistema de logging en VS Code.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';
import * as vscode from 'vscode';

import { isDefined } from '../internals/isDefined';
import { emptyConfigurationInspect } from '../internals/testing/mockVscodeConfigurationInspect';

import { QueuedNdjsonFileTransport } from './transports/file';

import type { LogEntry } from '../internals/protocols/types/typeLog';

const hoisted = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  logFileEnabled: true,
  logFileMaxBytes: 10_000_000,
  joinPath: (base: { fsPath: string }, ...parts: string[]) => {
    const fsPath = [base.fsPath, ...parts].filter(Boolean).join('/');
    return { scheme: 'file', fsPath, path: fsPath, toString: () => `file://${fsPath}` };
  },
}));

vi.mock('vscode', () => {
  const { files, logFileEnabled, logFileMaxBytes, joinPath } = hoisted;

  return {
    Uri: {
      file: (p: string) => ({ scheme: 'file', fsPath: p, path: p, toString: () => `file://${p}` }),
      joinPath,
    },
    workspace: {
      fs: {
        readFile: vi.fn((uri: { fsPath: string }) => {
          const v = files.get(uri.fsPath);
          if (!v) {
            return Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
          }
          return Promise.resolve(new Uint8Array(v));
        }),
        writeFile: vi.fn((uri: { fsPath: string }, content: Uint8Array) => {
          files.set(uri.fsPath, new Uint8Array(content));
          return Promise.resolve();
        }),
        createDirectory: vi.fn(() => Promise.resolve()),
        stat: vi.fn((uri: { fsPath: string }) => {
          const v = files.get(uri.fsPath);
          if (!v) {
            return Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
          }
          return Promise.resolve({ type: 1 as const, ctime: 0, mtime: 0, size: v.byteLength });
        }),
        delete: vi.fn((uri: { fsPath: string }) => {
          files.delete(uri.fsPath);
          return Promise.resolve();
        }),
      },
      getConfiguration: vi.fn(() => ({
        get: vi.fn((key: string, defaultValue?: unknown) => {
          if (key === 'logFileEnabled') {
            return logFileEnabled;
          }
          if (key === 'logFileMaxBytes') {
            return logFileMaxBytes;
          }
          return defaultValue;
        }),
        inspect: vi.fn(() => emptyConfigurationInspect),
      })),
      onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    },
    window: {
      createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
        dispose: vi.fn(),
      })),
    },
    'Disposable': class {
      constructor(private readonly callback: () => void) {}
      dispose(): void {
        this.callback();
      }
    },
  };
});

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  timestamp: new Date().toISOString(),
  level: 'INFO',
  module: 'test',
  message: 'evt',
  ...over,
});

vitest.describe('QueuedNdjsonFileTransport (mock vscode)', () => {
  vitest.beforeEach(() => {
    hoisted.files.clear();
    hoisted.logFileEnabled = true;
    hoisted.logFileMaxBytes = 10_000_000;
  });

  vitest.it('no persiste cuando logFileEnabled es falso', async () => {
    hoisted.logFileEnabled = false;
    const logsDirectory = vscode.Uri.file('/logs/off');
    const t = new QueuedNdjsonFileTransport(
      logsDirectory,
      () => hoisted.logFileEnabled,
      () => hoisted.logFileMaxBytes,
    );
    await t.write(entry());
    await t.dispose();
    vitest.expect(hoisted.files.size).toBe(0);
  });

  vitest.it('escribe NDJSON y Markdown tras dispose', async () => {
    const logsDirectory = vscode.Uri.file('/logs/ok');
    const ndPath = vscode.Uri.joinPath(logsDirectory, 'events.ndjson').fsPath;
    const mdPath = vscode.Uri.joinPath(logsDirectory, 'session.md').fsPath;
    const t = new QueuedNdjsonFileTransport(
      logsDirectory,
      () => hoisted.logFileEnabled,
      () => hoisted.logFileMaxBytes,
    );
    await t.write(entry({ message: 'one' }));
    await t.dispose();
    const nd = hoisted.files.get(ndPath);
    vitest.expect(nd).toBeDefined();
    if (!isDefined(nd)) {
      throw new Error('expected ndjson bytes');
    }
    const text = Buffer.from(nd).toString('utf8');
    vitest.expect(text).toContain('"message":"one"');
    const md = hoisted.files.get(mdPath);
    vitest.expect(md).toBeDefined();
    if (!isDefined(md)) {
      throw new Error('expected markdown bytes');
    }
    vitest.expect(Buffer.from(md).toString('utf8')).toContain('one');
  });
});
