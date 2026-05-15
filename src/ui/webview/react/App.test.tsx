/**
 * @file Pruebas de integración del punto de entrada React del webview.
 */
type VsCodeApi = { postMessage: (message: unknown) => void };

const { postMessageMock } = vi.hoisted(() => {
  const pm = vi.fn();
  const globalWithApi = globalThis as unknown as { window?: unknown; acquireVsCodeApi?: () => VsCodeApi };
  globalWithApi.window = globalWithApi;
  globalWithApi.acquireVsCodeApi = () => ({ postMessage: pm });
  return { postMessageMock: pm };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { App, postToHost } from './App';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

/**
 * Renders the app to static HTML for snapshot-style verification.
 * @returns {string} The rendered HTML output.
 */
function renderApp() {
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe('GhostPrompt React webview App', () => {
  it('renders the bottom bar with initial status line', () => {
    const html = renderApp();

    expect(html).toContain('Copilot LM');
    expect(html).toContain('Auto');
    expect(html).toContain('Empieza a escribir para obtener sugerencias...');
  });

  it('posts outbound messages using the VS Code API when available', () => {
    postToHost({ type: 'init' });

    expect(postMessageMock).toHaveBeenCalledWith({ type: 'init' });
  });
});
