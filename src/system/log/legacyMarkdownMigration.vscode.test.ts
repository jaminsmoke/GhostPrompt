import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import {
  disposeGhostPromptLogging,
  initGhostPromptLogging,
} from './LogManager';

describe('migración Markdown legacy (LogManager)', () => {
  beforeEach(async () => {
    await disposeGhostPromptLogging();
    hoisted.files.clear();
    hoisted.logFileEnabled = true;
    hoisted.logFileMaxBytes = 10_000_000;
  });

  afterEach(async () => {
    await disposeGhostPromptLogging();
  });

  it('importa suggestions.md y escribe el marcador', async () => {
    const wsRoot = vscode.Uri.file('/ws');
    const globalRoot = vscode.Uri.file('/g');
    const suggPath = vscode.Uri.joinPath(wsRoot, 'suggestions.md').fsPath;
    const flagPath = vscode.Uri.joinPath(
      globalRoot,
      'ghostPrompt',
      'logs',
      'v1',
      '.legacy-md-imported.json',
    ).fsPath;
    const ndPath = vscode.Uri.joinPath(
      globalRoot,
      'ghostPrompt',
      'logs',
      'v1',
      'events.ndjson',
    ).fsPath;

    hoisted.files.set(suggPath, new Uint8Array(Buffer.from('contenido legacy', 'utf-8')));

    const ctx = {
      subscriptions: [] as { dispose: () => void }[],
      globalStorageUri: globalRoot,
      storageUri: wsRoot,
    } as vscode.ExtensionContext;

    initGhostPromptLogging(ctx);

    await vi.waitFor(
      () => {
        expect(hoisted.files.has(flagPath)).toBe(true);
      },
      { timeout: 3000, interval: 5 },
    );

    const flag = JSON.parse(Buffer.from(hoisted.files.get(flagPath)!).toString('utf-8'));
    expect(flag.snapshots).toBe(1);

    const nd = hoisted.files.get(ndPath);
    expect(nd).toBeDefined();
    const lines = Buffer.from(nd!).toString('utf-8').trim().split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const first = JSON.parse(lines[0]!);
    expect(first.module).toBe('migration');
    expect(first.message).toBe('legacy-md-snapshot');
    expect(first.data.preview).toContain('contenido legacy');

    await disposeGhostPromptLogging();
  });

  it('no escribe NDJSON si el marcador ya existía', async () => {
    const wsRoot = vscode.Uri.file('/ws');
    const globalRoot = vscode.Uri.file('/g');
    const suggPath = vscode.Uri.joinPath(wsRoot, 'suggestions.md').fsPath;
    const flagPath = vscode.Uri.joinPath(
      globalRoot,
      'ghostPrompt',
      'logs',
      'v1',
      '.legacy-md-imported.json',
    ).fsPath;
    const ndPath = vscode.Uri.joinPath(
      globalRoot,
      'ghostPrompt',
      'logs',
      'v1',
      'events.ndjson',
    ).fsPath;

    hoisted.files.set(suggPath, new Uint8Array(Buffer.from('solo una vez', 'utf-8')));
    hoisted.files.set(
      flagPath,
      new Uint8Array(
        Buffer.from(
          JSON.stringify({ importedAt: new Date().toISOString(), snapshots: 0 }),
          'utf-8',
        ),
      ),
    );

    const ctx = {
      subscriptions: [] as { dispose: () => void }[],
      globalStorageUri: globalRoot,
      storageUri: wsRoot,
    } as vscode.ExtensionContext;

    initGhostPromptLogging(ctx);
    await new Promise((r) => setTimeout(r, 50));
    await disposeGhostPromptLogging();

    expect(hoisted.files.has(ndPath)).toBe(false);
  });
});
