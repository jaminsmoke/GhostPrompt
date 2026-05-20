/**
 * @file Regresión: paridad funcional del toolbar entre sidebar y panel (mismo bundle webview).
 * @see Docs/Plans/Roadmaps/Roadmap-v0.3.1-webview-parity-contracts-ux.md Fase A
 * @see Docs/Plans/Roadmaps/Roadmap-v0.4.3-quality-resilience.md Fase 5 (gobernanza dual webview)
 */
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as vitest from 'vitest';

const repoRoot = join(import.meta.dirname, '../../..');

const WEBVIEW_TOOLBAR_SETTING_GROUP_COUNT = 4;

/**
 * Reads a file relative to the repository root.
 * @param {string} relativePath - The relative path from the repo root.
 * @returns {string} The file contents as a string.
 */
function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

vitest.describe('React webview toolbar parity', () => {
  vitest.it('GhostToolbar defines exactly four setting groups with stable data-keys', () => {
    const toolbar = read('src/ui/webview/react/components/GhostToolbar.tsx');
    const panels = read('src/ui/webview/react/components/GhostToolbarPanels.tsx');
    const composicion = read('src/ui/webview/react/components/GhostToolbarComposicionPanel.tsx');
    const source = `${toolbar}\n${panels}\n${composicion}`;
    vitest.expect(source.match(/data-key="/gu)?.length).toBe(WEBVIEW_TOOLBAR_SETTING_GROUP_COUNT);
    for (const key of [
      'completionProvider',
      'agentDestination',
      'suggestionModelPolicy',
      'maxSuggestionChars',
    ]) {
      vitest.expect(source).toContain(`data-key="${key}"`);
    }
  });

  vitest.it('component files expose stable toolbar chip ids shared by both webviews', () => {
    const toolbar = read('src/ui/webview/react/components/GhostToolbar.tsx');
    const input = read('src/ui/webview/react/components/PromptInput.tsx');
    const app = read('src/ui/webview/react/App.tsx');

    vitest.expect(toolbar).toContain('id="motor-chip"');
    vitest.expect(toolbar).toContain('id="modelo-chip"');
    vitest.expect(toolbar).toContain('id="composicion-chip"');
    vitest.expect(toolbar).toContain('id="gear-chip"');
    vitest.expect(toolbar).toContain('id="destino-chip"');
    vitest.expect(toolbar).toContain('id="debug-btn"');

    vitest.expect(input).toContain('id="prompt-input"');
    vitest.expect(app).toContain('id="gp-vsx-surface-note"');
    const bottomBar = read('src/ui/webview/react/components/BottomBar.tsx');
    vitest.expect(bottomBar).toContain('id="send-btn"');
  });

  vitest.it('webviewHtml loads the React built index document', () => {
    const src = read('src/ui/provider/webviewHtml.ts');
    vitest.expect(src).toContain("'dist'");
    vitest.expect(src).toContain("'react'");
    vitest.expect(src).toContain("'index.html'");
  });

  vitest.it('MiniInputViewProvider usa el builder de HTML compartido', () => {
    const src = read('src/ui/provider/MiniInputViewProvider.ts');
    vitest.expect(src).toContain('buildGhostPromptWebviewHtml');
    vitest.expect(src).toContain('ghostPrompt.input');
    vitest.expect(src).toContain('ghostPrompt.inputPanel');
  });
});
