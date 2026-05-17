/**
 * @file Pruebas de tokens de tema para el webview GhostPrompt.
 */
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as vitest from 'vitest';

const repoRoot = join(import.meta.dirname, '../../..');

vitest.describe('webview theme tokens (v0.3.1 Fase D)', () => {
  vitest.it('React webview CSS uses Tailwind directives', () => {
    const css = readFileSync(join(repoRoot, 'src/ui/webview/react/index.css'), 'utf8');
    vitest.expect(css).toMatch(/@import\s+["']tailwindcss["'];/u);
  });
});
