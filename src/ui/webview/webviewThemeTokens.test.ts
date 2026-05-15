/// <reference types="node" />
/**
 * @file Pruebas de tokens de tema para el webview GhostPrompt.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('webview theme tokens (v0.3.1 Fase D)', () => {
  it('React webview CSS uses Tailwind directives', () => {
    const css = readFileSync(join(repoRoot, 'src/ui/webview/react/index.css'), 'utf8');
    expect(css).toMatch(/@import\s+['"]tailwindcss['"];/);
  });
});
