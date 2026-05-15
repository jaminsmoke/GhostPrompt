import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  logFileEnabled: true,
  logFileMaxBytes: 10_000_000,
}));

vi.mock('vscode', () => {
  const { files, logFileEnabled, logFileMaxBytes } = hoisted;

  const joinPath = (base: { fsPath: string }, ...parts: string[]) => {
    const fsPath = [base.fsPath, ...parts].filter(Boolean).join('/');
    return { scheme: 'file', fsPath, path: fsPath, toString: () => `file://${fsPath}` };
  };

  return {
    Uri: {
      file: (p: string) => ({ scheme: 'file', fsPath: p, path: p, toString: () => `file://${p}` }),
      joinPath,
    },
    workspace: {
      fs: {
        readFile: vi.fn(async (uri: { fsPath: string }) => {
          const v = files.get(uri.fsPath);
          if (!v) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          return new Uint8Array(v);
        }),
        writeFile: vi.fn(async (uri: { fsPath: string }, content: Uint8Array) => {
          files.set(uri.fsPath, new Uint8Array(content));
        }),
        createDirectory: vi.fn(async () => {}),
        stat: vi.fn(async (uri: { fsPath: string }) => {
          const v = files.get(uri.fsPath);
          if (!v) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          return { type: 1 as const, ctime: 0, mtime: 0, size: v.byteLength };
        }),
        delete: vi.fn(async (uri: { fsPath: string }) => {
          files.delete(uri.fsPath);
        }),
      },
      getConfiguration: vi.fn(() => ({
        get: vi.fn((key: string, def?: unknown) => {
          if (key === 'logFileEnabled') {
            return logFileEnabled;
          }
          if (key === 'logFileMaxBytes') {
            return logFileMaxBytes;
          }
          return def;
        }),
        inspect: vi.fn(() => ({
          globalValue: undefined,
          workspaceValue: undefined,
          workspaceFolderValue: undefined,
        })),
      })),
      onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    },
    window: {
      createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
        dispose: vi.fn(),
      })),
    },
    Disposable: class {
      constructor(private readonly callback: () => void) {}
      dispose(): void {
        this.callback();
      }
    },
  };
});

import * as vscode from 'vscode';

import { QueuedNdjsonFileTransport } from './transports/file';
import type { LogEntry } from './types';

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  timestamp: new Date().toISOString(),
  level: 'INFO',
  module: 'test',
  message: 'evt',
  ...over,
});

describe('QueuedNdjsonFileTransport (mock vscode)', () => {
  beforeEach(() => {
    hoisted.files.clear();
    hoisted.logFileEnabled = true;
    hoisted.logFileMaxBytes = 10_000_000;
  });

  it('no persiste cuando logFileEnabled es falso', async () => {
    hoisted.logFileEnabled = false;
    const logsDir = vscode.Uri.file('/logs/off');
    const t = new QueuedNdjsonFileTransport(
      logsDir,
      () => hoisted.logFileEnabled,
      () => hoisted.logFileMaxBytes,
    );
    await t.write(entry());
    await t.dispose();
    expect(hoisted.files.size).toBe(0);
  });

  it('escribe NDJSON y Markdown tras dispose', async () => {
    const logsDir = vscode.Uri.file('/logs/ok');
    const ndPath = vscode.Uri.joinPath(logsDir, 'events.ndjson').fsPath;
    const mdPath = vscode.Uri.joinPath(logsDir, 'session.md').fsPath;
    const t = new QueuedNdjsonFileTransport(
      logsDir,
      () => hoisted.logFileEnabled,
      () => hoisted.logFileMaxBytes,
    );
    await t.write(entry({ message: 'one' }));
    await t.dispose();
    const nd = hoisted.files.get(ndPath);
    expect(nd).toBeDefined();
    const text = Buffer.from(nd!).toString('utf-8');
    expect(text).toContain('"message":"one"');
    const md = hoisted.files.get(mdPath);
    expect(md).toBeDefined();
    expect(Buffer.from(md!).toString('utf-8')).toContain('one');
  });
});
