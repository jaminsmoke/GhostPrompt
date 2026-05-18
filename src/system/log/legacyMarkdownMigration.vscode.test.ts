/**
 * @file Tests de migración de markdown legacy para VS Code.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';
import * as vscode from 'vscode';

const TEST_MIGRATION_YIELD_MS = 50;

import { isDefined } from '../internals/isDefined';
import { emptyConfigurationInspect } from '../internals/testing/mockVscodeConfigurationInspect';

import {
  disposeGhostPromptLogging,
  initGhostPromptLogging,
} from './LogManager';

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
    'Uri': {
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

vitest.describe('migración Markdown legacy (LogManager)', () => {
  vitest.beforeEach(async () => {
    await disposeGhostPromptLogging();
    hoisted.files.clear();
    hoisted.logFileEnabled = true;
    hoisted.logFileMaxBytes = 10_000_000;
  });

  vitest.afterEach(async () => {
    await disposeGhostPromptLogging();
  });

  vitest.it('importa suggestions.md y escribe el marcador', async () => {
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

    hoisted.files.set(suggPath, new Uint8Array(Buffer.from('contenido legacy', 'utf8')));

    const ctx = {
      subscriptions: [] as { dispose: () => void }[],
      globalStorageUri: globalRoot,
      storageUri: wsRoot,
    } as vscode.ExtensionContext;

    initGhostPromptLogging(ctx);

    await vi.waitFor(
      () => {
        vitest.expect(hoisted.files.has(flagPath)).toBe(true);
      },
      { timeout: 3000, interval: 5 },
    );

    const flagBytes = hoisted.files.get(flagPath);
    vitest.expect(flagBytes).toBeDefined();
    if (!isDefined(flagBytes)) {
      throw new Error('expected flag bytes');
    }
    const flag = JSON.parse(Buffer.from(flagBytes).toString('utf8')) as {
      snapshots: number;
    };
    vitest.expect(flag.snapshots).toBe(1);

    const nd = hoisted.files.get(ndPath);
    vitest.expect(nd).toBeDefined();
    if (!isDefined(nd)) {
      throw new Error('expected ndjson bytes');
    }
    const lines = Buffer.from(nd)
      .toString('utf8')
      .trim()
      .split('\n')
      .filter(Boolean);
    vitest.expect(lines.length).toBeGreaterThanOrEqual(1);
    const first = JSON.parse(lines[0]) as {
      module: string;
      message: string;
      data: { preview: string };
    };
    vitest.expect(first.module).toBe('migration');
    vitest.expect(first.message).toBe('legacy-md-snapshot');
    vitest.expect(first.data.preview).toContain('contenido legacy');

    await disposeGhostPromptLogging();
  });

  vitest.it('no escribe NDJSON si el marcador ya existía', async () => {
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

    hoisted.files.set(suggPath, new Uint8Array(Buffer.from('solo una vez', 'utf8')));
    hoisted.files.set(
      flagPath,
      new Uint8Array(
        Buffer.from(
          JSON.stringify({ importedAt: new Date().toISOString(), snapshots: 0 }),
          'utf8',
        ),
      ),
    );

    const ctx = {
      subscriptions: [] as { dispose: () => void }[],
      globalStorageUri: globalRoot,
      storageUri: wsRoot,
    } as vscode.ExtensionContext;

    initGhostPromptLogging(ctx);
    await new Promise((resolve) => {
      setTimeout(resolve, TEST_MIGRATION_YIELD_MS);
    });
    await disposeGhostPromptLogging();

    vitest.expect(hoisted.files.has(ndPath)).toBe(false);
  });
});
