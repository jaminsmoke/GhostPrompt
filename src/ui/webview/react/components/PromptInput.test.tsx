/**
 * @file Pruebas unitarias del componente PromptInput del webview.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import * as vitest from 'vitest';
import { vi } from 'vitest';

const globalWithWindow = globalThis as unknown as { window?: unknown };
globalWithWindow.window = globalWithWindow;

import { PromptInput } from './PromptInput';

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
    textareaRef: { current: undefined },
    isGhostUiAllowed: () => false,
    onTextChange: vi.fn(),
    onSend: vi.fn(),
    onAccept: vi.fn(),
    onCursorCheck: vi.fn(),
    ...overrides,
  };
}

/**
 * Extracts the first &lt;pre> element from rendered HTML.
 * @param {string} html - The rendered HTML string to inspect.
 * @returns {string | undefined} The first &lt;pre> element markup if present.
 */
function extractPre(html: string): string | undefined {
  const match = /<pre[\S\s]*?<\/pre>/u.exec(html);
  return match ? match[0] : undefined;
}

vitest.describe('PromptInput ghost overlay', () => {
  vitest.it('renders invisible user text before visible suggestion in pre', () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProperties({ text: 'hello', suggestion: ' world' })} />,
    );
    const pre = extractPre(html);

    vitest.expect(pre).toBeDefined();
    vitest.expect(pre).toContain('class="opacity-0"');
    vitest.expect(pre).toContain('hello');
    vitest.expect(pre).toContain(' world');
  });

  vitest.it('hides overlay when suggestion is empty', () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProperties({ text: 'hello', suggestion: '' })} />,
    );

    vitest.expect(extractPre(html)).toBeUndefined();
  });

  vitest.it('hides overlay when text is empty', () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProperties({ text: '', suggestion: 'world' })} />,
    );

    vitest.expect(extractPre(html)).toBeUndefined();
  });

  vitest.it('ghost pre has alignment classes matching textarea', () => {
    const pre = extractPre(
      renderToStaticMarkup(
        <PromptInput {...createMockProperties({ text: 'foo', suggestion: 'bar' })} />,
      ),
    );

    vitest.expect(pre).toContain('inset-px');
    vitest.expect(pre).toContain('px-3');
    vitest.expect(pre).toContain('py-2');
    vitest.expect(pre).toContain('overflow-auto');
  });

  vitest.it('ghost suggestion uses 70% opacity token', () => {
    const pre = extractPre(
      renderToStaticMarkup(
        <PromptInput {...createMockProperties({ text: 'foo', suggestion: 'bar' })} />,
      ),
    );

    vitest.expect(pre).toContain('text-(--vscode-input-foreground)/70');
  });

  vitest.it('renders textarea with prompt-input id', () => {
    const html = renderToStaticMarkup(<PromptInput {...createMockProperties()} />);

    vitest.expect(html).toContain('id="prompt-input"');
  });
});
