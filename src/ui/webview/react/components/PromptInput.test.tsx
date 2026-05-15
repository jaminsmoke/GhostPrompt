/**
 * @file Pruebas unitarias del componente PromptInput del webview.
 */
const globalWithWindow = globalThis as unknown as { window?: unknown };
globalWithWindow.window = globalWithWindow;

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PromptInput } from './PromptInput';

/**
 * Builds props for the PromptInput component used in tests.
 * @param {Record<string, unknown>} [overrides] Partial prop values to override in the mock.
 * @returns {Record<string, unknown>} Props suitable for rendering PromptInput in snapshot tests.
 */
function createMockProps(overrides: Record<string, unknown> = {}) {
  return {
    text: '',
    suggestion: '',
    vsxActive: false,
    compact: false,
    textareaRef: { current: null },
    isGhostUiAllowed: () => false,
    onTextChange: vi.fn(),
    onSend: vi.fn(),
    onAccept: vi.fn(),
    onCursorCheck: vi.fn(),
    ...overrides,
  };
}

/**
 * Extracts the first <pre> element from rendered HTML.
 * @param {string} html The rendered HTML string to inspect.
 * @returns {string | null} The first <pre> element markup, or null if none exists.
 */
function extractPre(html: string): string | null {
  const match = /<pre[\s\S]*?<\/pre>/.exec(html);
  return match ? match[0] : null;
}

describe('PromptInput ghost overlay', () => {
  it('renders invisible user text before visible suggestion in pre', () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProps({ text: 'hello', suggestion: ' world' })} />,
    );
    const pre = extractPre(html);

    expect(pre).not.toBeNull();
    expect(pre).toContain('class="opacity-0"');
    expect(pre).toContain('hello');
    expect(pre).toContain(' world');
  });

  it('hides overlay when suggestion is empty', () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProps({ text: 'hello', suggestion: '' })} />,
    );

    expect(extractPre(html)).toBeNull();
  });

  it('hides overlay when text is empty', () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProps({ text: '', suggestion: 'world' })} />,
    );

    expect(extractPre(html)).toBeNull();
  });

  it('ghost pre has alignment classes matching textarea', () => {
    const pre = extractPre(
      renderToStaticMarkup(
        <PromptInput {...createMockProps({ text: 'foo', suggestion: 'bar' })} />,
      ),
    );

    expect(pre).toContain('inset-px');
    expect(pre).toContain('px-3');
    expect(pre).toContain('py-2');
    expect(pre).toContain('overflow-auto');
  });

  it('ghost suggestion uses 70% opacity token', () => {
    const pre = extractPre(
      renderToStaticMarkup(
        <PromptInput {...createMockProps({ text: 'foo', suggestion: 'bar' })} />,
      ),
    );

    expect(pre).toContain('text-(--vscode-input-foreground)/70');
  });

  it('renders textarea with prompt-input id', () => {
    const html = renderToStaticMarkup(<PromptInput {...createMockProps()} />);

    expect(html).toContain('id="prompt-input"');
  });
});
