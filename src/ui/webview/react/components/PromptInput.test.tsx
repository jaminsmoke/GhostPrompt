/**
 * @file Pruebas unitarias del componente PromptInput del webview.
 */
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as vitest from 'vitest';
import { vi } from 'vitest';

const globalWithWindow = globalThis as unknown as { window?: unknown };
globalWithWindow.window = globalWithWindow;

import { GP_PROMPT_FIELD_CLASS, GP_PROMPT_FIELD_EDITOR_CLASS, PromptInput } from './PromptInput';

/**
 * Builds props for the PromptInput component used in tests.
 * @param {Record<string, unknown>} [overrides] - Partial prop values to override in the mock.
 * @returns {Record<string, unknown>} Props suitable for rendering PromptInput in snapshot tests.
 */
function createMockProperties(overrides: Record<string, unknown> = {}) {
  return {
    text: '',
    suggestion: '',
    vsxActive: false,
    compact: false,
    textareaRef: createRef<HTMLTextAreaElement>(),
    isGhostUiAllowed: () => false,
    onTextChange: vi.fn(),
    onSend: vi.fn(),
    onAccept: vi.fn(),
    onCursorCheck: vi.fn(),
    ...overrides,
  };
}

/**
 * Extracts the ghost overlay element from rendered HTML.
 * @param {string} html - The rendered HTML string to inspect.
 * @returns {string | false} Overlay markup if present.
 */
function extractGhostOverlay(html: string): string | false {
  const match = /class="[^"]*gp-prompt-ghost[\S\s]*?<\/div>/u.exec(html);
  return match ? match[0] : false;
}

vitest.describe('PromptInput ghost overlay', () => {
  vitest.it('renders invisible user text and visible muted suggestion in overlay', () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProperties({ text: 'hello', suggestion: ' world' })} />,
    );
    const overlay = extractGhostOverlay(html);

    vitest.expect(overlay).toBeDefined();
    vitest.expect(overlay).toContain('opacity-0');
    vitest.expect(overlay).toContain('hello');
    vitest.expect(overlay).toContain(' world');
    vitest.expect(overlay).toContain('gp-prompt-ghost__suggestion');
  });

  vitest.it('textarea keeps visible foreground (no transparent hack)', () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProperties({ text: 'hello', suggestion: ' world' })} />,
    );

    vitest.expect(html).toContain('text-(--vscode-input-foreground)');
    vitest.expect(html).not.toContain('text-transparent');
  });

  vitest.it('overlay is above textarea in DOM order with higher z-index', () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProperties({ text: 'hello', suggestion: ' world' })} />,
    );
    const textareaIndex = html.indexOf('id="prompt-input"');
    const overlayIndex = html.indexOf('gp-prompt-ghost');

    vitest.expect(textareaIndex).toBeGreaterThan(-1);
    vitest.expect(overlayIndex).toBeGreaterThan(textareaIndex);
    vitest.expect(html).toContain('z-10');
    vitest.expect(html).not.toContain('z-20');
  });

  vitest.it('hides overlay when suggestion is empty', () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProperties({ text: 'hello', suggestion: '' })} />,
    );

    vitest.expect(extractGhostOverlay(html)).toBe(false);
  });

  vitest.it('hides overlay when text is empty', () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProperties({ text: '', suggestion: 'world' })} />,
    );

    vitest.expect(extractGhostOverlay(html)).toBe(false);
  });

  vitest.it('overlay shares padding and typography with textarea', () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProperties({ text: 'foo', suggestion: 'bar' })} />,
    );
    const overlay = extractGhostOverlay(html);

    vitest.expect(overlay).toContain(GP_PROMPT_FIELD_EDITOR_CLASS.split(' ')[0]);
    vitest.expect(html).toContain('gp-prompt-field__editor');
    vitest.expect(html).toContain('px-3');
    vitest.expect(html).toContain('py-2');
    vitest.expect(html).toContain('leading-6');
    vitest.expect(html).toContain('whitespace-pre-wrap');
  });

  vitest.it('uses grid shell and scrollbar-gutter on textarea only', () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProperties({ text: 'foo', suggestion: 'bar' })} />,
    );

    vitest.expect(html).toContain(GP_PROMPT_FIELD_CLASS);
    vitest.expect(html).toContain('grid grid-cols-1 grid-rows-1');
    vitest.expect(html).toContain('gp-prompt-field__textarea');
    vitest.expect(html).toContain('[scrollbar-gutter:stable]');
    vitest.expect(html).toContain('col-start-1 row-start-1');
  });

  vitest.it('renders textarea with prompt-input id', () => {
    const html = renderToStaticMarkup(<PromptInput {...createMockProperties()} />);

    vitest.expect(html).toContain('id="prompt-input"');
  });
});
