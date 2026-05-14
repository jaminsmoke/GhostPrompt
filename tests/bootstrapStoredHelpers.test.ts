import { describe, expect, it } from 'vitest';

import {
  isProjectMemoryBootstrapStoredItem,
  mergeEntriesReplacingBootstrapSubset,
  mergeValidatedBootstrapWithLive,
  pruneBootstrapStoredAgainstFileProbes,
} from '../src/core/memory/entries/bootstrap';
import { PROJECT_BOOTSTRAP_ENTRY_KIND } from '../src/core/memory/types';
import type { ProjectMemoryBootstrapStoredItem } from '../src/core/memory/types';

function item(r: Omit<ProjectMemoryBootstrapStoredItem, 'kind'>): ProjectMemoryBootstrapStoredItem {
  return {
    ...r,
    kind: PROJECT_BOOTSTRAP_ENTRY_KIND,
  };
}

describe('pruneBootstrapStoredAgainstFileProbes', () => {
  const prev = [
    item({
      relativePath: 'README.md',
      promptLine: 'old',
      sourceMtimeMs: 100,
      sourceSha256: 'ab'.repeat(32),
    }),
  ];

  it('elimina entrada si falta el fichero en probes', () => {
    expect(pruneBootstrapStoredAgainstFileProbes(prev, {}).length).toBe(0);
  });

  it('elimina entrada si cambia mtime o hash', () => {
    expect(
      pruneBootstrapStoredAgainstFileProbes(prev, {
        'README.md': { mtimeMs: 999, sha256: 'ab'.repeat(32) },
      }).length,
    ).toBe(0);
    expect(
      pruneBootstrapStoredAgainstFileProbes(prev, {
        'README.md': { mtimeMs: 100, sha256: '00'.repeat(32) },
      }).length,
    ).toBe(0);
  });

  it('conserva entrada si mtime y hash coinciden', () => {
    const kept = pruneBootstrapStoredAgainstFileProbes(prev, {
      'README.md': { mtimeMs: 100, sha256: 'ab'.repeat(32) },
    });
    expect(kept).toHaveLength(1);
    expect(kept[0].promptLine).toBe('old');
  });
});

describe('mergeValidatedBootstrapWithLive', () => {
  it('prioriza vivas ante paths coincidentes y conserva válidas si live omite ese path', () => {
    const probes = {
      'package.json': { mtimeMs: 500, sha256: '11'.repeat(32) },
      'README.md': { mtimeMs: 700, sha256: '22'.repeat(32) },
    } as const;
    const prevValid = pruneBootstrapStoredAgainstFileProbes(
      [
        item({
          relativePath: 'package.json',
          promptLine: 'pkg stored',
          sourceMtimeMs: 500,
          sourceSha256: '11'.repeat(32),
        }),
        item({
          relativePath: 'README.md',
          promptLine: 'readme stored',
          sourceMtimeMs: 700,
          sourceSha256: '22'.repeat(32),
        }),
      ],
      probes,
    );

    const live = [
      item({
        relativePath: 'README.md',
        promptLine: 'readme live',
        sourceMtimeMs: 800,
        sourceSha256: '33'.repeat(32),
      }),
    ];

    const merged = mergeValidatedBootstrapWithLive(prevValid, probes, live);
    expect(merged.find((x) => x.relativePath === 'README.md')!.promptLine).toBe('readme live');
    expect(merged.some((x) => x.relativePath === 'package.json')).toBe(true);
  });

  it('tras conflicto hash en probe, readme cae y sólo llega por live si se aporta', () => {
    const readmePrev = [
      item({
        relativePath: 'README.md',
        promptLine: 'stale readme',
        sourceMtimeMs: 100,
        sourceSha256: 'aa'.repeat(32),
      }),
    ];

    const wrongProbe = pruneBootstrapStoredAgainstFileProbes(readmePrev, {
      'README.md': { mtimeMs: 200, sha256: 'bb'.repeat(32) },
    });
    expect(wrongProbe).toHaveLength(0);

    const liveReadme = mergeValidatedBootstrapWithLive(
      readmePrev,
      { 'README.md': { mtimeMs: 200, sha256: 'bb'.repeat(32) } },
      [],
    );
    expect(liveReadme).toHaveLength(0);
  });
});
