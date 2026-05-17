/**
 * @file Pruebas de integración del punto de entrada React del webview.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import * as vitest from 'vitest';
import { vi } from 'vitest';

type VsCodeApi = { postMessage: (message: unknown) => void };

const { postMessageMock } = vi.hoisted(() => {
  const pm = vi.fn();
  const globalWithApi = globalThis as unknown as { window?: unknown; acquireVsCodeApi?: () => VsCodeApi };
  globalWithApi.window = globalWithApi;
  globalWithApi.acquireVsCodeApi = () => ({ postMessage: pm });
  return { postMessageMock: pm };
});

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

vitest.describe('GhostPrompt React webview App', () => {
  vitest.it('renders the bottom bar with initial status line', () => {
    const html = renderApp();

    vitest.expect(html).toContain('Copilot LM');
    vitest.expect(html).toContain('Auto');
    vitest.expect(html).toContain('Empieza a escribir para obtener sugerencias...');
  });

  vitest.it('posts outbound messages using the VS Code API when available', () => {
    postToHost({ type: 'init' });

    vitest.expect(postMessageMock).toHaveBeenCalledWith({ type: 'init' });
  });
});
