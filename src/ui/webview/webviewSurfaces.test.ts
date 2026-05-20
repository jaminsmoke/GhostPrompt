/**
 * @file Regresión: superficies chat (sidebar) vs hub (panel) con bundles compartidos.
 * @see Docs/Plans/Roadmaps/v0.6.2/05-dual-surface-chat-hub.md fase FW
 */
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as vitest from 'vitest';

const repoRoot = join(import.meta.dirname, '../../..');

/**
 * Reads a file relative to the repository root.
 * @param {string} relativePath - The relative path from the repo root.
 * @returns {string} The file contents as a string.
 */
function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

vitest.describe('React webview surfaces (FW)', () => {
  vitest.it('ChatApp monta PromptInput y nota VSOpenCodeX', () => {
    const chat = read('src/ui/webview/react/surfaces/chat/ChatApp.tsx');
    const promptInput = read('src/ui/webview/react/components/PromptInput.tsx');
    vitest.expect(chat).toContain('<PromptInput');
    vitest.expect(promptInput).toContain('id="prompt-input"');
    vitest.expect(chat).toContain('id="gp-vsx-surface-note"');
    vitest.expect(chat).toContain('surface="chat"');
  });

  vitest.it('HubApp no monta PromptInput y expone sección de estadísticas', () => {
    const hub = read('src/ui/webview/react/surfaces/hub/HubApp.tsx');
    vitest.expect(hub).not.toContain('PromptInput');
    vitest.expect(hub).toContain('id="gp-hub-stats"');
    vitest.expect(hub).toContain('surface="hub"');
  });

  vitest.it('GhostPromptRoot enruta según resolveGhostPromptWebviewSurface', () => {
    const root = read('src/ui/webview/react/surfaces/GhostPromptRoot.tsx');
    vitest.expect(root).toContain('resolveGhostPromptWebviewSurface');
    vitest.expect(root).toContain('<HubApp');
    vitest.expect(root).toContain('<ChatApp');
  });
});
