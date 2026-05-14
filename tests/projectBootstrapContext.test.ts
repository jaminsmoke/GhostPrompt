import { beforeEach, describe, expect, it, vi } from 'vitest';

const readFileMock = vi.hoisted(() => vi.fn());
const statMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    type: 1,
    ctime: 0,
    mtime: 1_725_900_800_456,
    size: 100,
  }),
);

vi.mock('vscode', () => ({
  Uri: {
    joinPath: (base: { fsPath: string }, ...segments: string[]) => ({
      fsPath: segments.reduce((acc, s) => `${acc.replace(/\/$/, '')}/${s}`, base.fsPath),
    }),
  },
  window: {
    activeTextEditor: undefined,
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/virtual/ws' } }],
    getWorkspaceFolder: () => undefined,
    fs: {
      stat: (uri: { fsPath: string }) => statMock(uri.fsPath),
      readFile: (uri: { fsPath: string }) => readFileMock(uri.fsPath),
    },
  },
}));

import {
  buildProjectBootstrapCardLines,
  fingerprintProjectBootstrapLines,
  summarizePackageJsonForProjectCard,
  truncateProjectCardText,
} from '../src/core/context/projectBootstrapContext';

describe('truncateProjectCardText', () => {
  it('devuelve el texto cuando cabe en el techo', () => {
    expect(truncateProjectCardText('uno dos', 20)).toBe('uno dos');
  });

  it('trunca al techo con elipsis cuando hace falta', () => {
    const src = `${'w'.repeat(30)} zona`;
    const out = truncateProjectCardText(src, 20);
    expect(out.endsWith('...')).toBe(true);
    expect(out.length).toBe(20);
  });
});

describe('summarizePackageJsonForProjectCard', () => {
  it('devuelve cadena vacía si el JSON es inválido', () => {
    expect(summarizePackageJsonForProjectCard('{no')).toBe('');
  });

  it('compone nombre, versión y scripts acotados', () => {
    const json = JSON.stringify({
      name: 'ghost-demo',
      version: '0.1.0',
      description: 'herramienta útil para tests',
      private: true,
      type: 'module',
      keywords: ['a', 'b'],
      scripts: {
        build: 'tsc',
        test: 'vitest run',
        lint: 'eslint .',
        start: 'node x',
      },
    });
    const s = summarizePackageJsonForProjectCard(json);
    expect(s).toContain('name=ghost-demo');
    expect(s).toContain('version=0.1.0');
    expect(s).toContain('private=true');
    expect(s).toContain('type=module');
    expect(s).toContain('keywords=a,b');
    expect(s).toContain('scripts: build,lint,start,test');
  });
});

describe('fingerprintProjectBootstrapLines', () => {
  it('devuelve vacío sin líneas', () => {
    expect(fingerprintProjectBootstrapLines([])).toBe('');
  });

  it('es estable para el mismo contenido', () => {
    const lines = ['a', 'b'] as const;
    expect(fingerprintProjectBootstrapLines(lines)).toBe(fingerprintProjectBootstrapLines(lines));
  });

  it('difiere si cambia el orden o el texto', () => {
    const a = fingerprintProjectBootstrapLines(['x']);
    const b = fingerprintProjectBootstrapLines(['y']);
    expect(a).not.toBe(b);
    expect(a.length).toBe(16);
  });
});

describe('buildProjectBootstrapCardLines', () => {
  beforeEach(() => {
    readFileMock.mockReset();
    statMock.mockClear();
    statMock.mockResolvedValue({
      type: 1,
      ctime: 0,
      mtime: 1_725_900_800_456,
      size: 100,
    });
  });

  it('ensambla README y package.json cuando existen', async () => {
    const enc = new TextEncoder();
    readFileMock.mockImplementation((fsPath: string) => {
      if (fsPath.endsWith('README.md')) {
        return Promise.resolve(enc.encode('Título\n\nPárrafo con detalle.'));
      }
      if (fsPath.endsWith('package.json')) {
        return Promise.resolve(enc.encode(JSON.stringify({ name: 'pkg', version: '1.0.0' })));
      }
      return Promise.reject(new Error('missing'));
    });

    const lines = await buildProjectBootstrapCardLines();
    expect(lines.length).toBe(2);
    expect(lines[0]).toMatch(/^README excerpt \(README\.md\):/);
    expect(lines[0]).toContain('Título');
    expect(lines[1]).toMatch(/^package\.json:/);
    expect(lines[1]).toContain('name=pkg');
  });

  it('omite README si no hay candidato y sigue con package.json', async () => {
    const enc = new TextEncoder();
    readFileMock.mockImplementation((fsPath: string) => {
      if (fsPath.endsWith('package.json')) {
        return Promise.resolve(enc.encode('{"name":"solo"}'));
      }
      return Promise.reject(new Error('enoent'));
    });

    const lines = await buildProjectBootstrapCardLines();
    expect(lines).toEqual([expect.stringMatching(/^package\.json:.*solo/)]);
  });
});
