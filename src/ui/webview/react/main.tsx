/**
 * @file Inicializador React del webview GhostPrompt.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { logToHost } from './hooks/ghostPromptLog';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Monta la aplicación React cuando el DOM del webview está listo.
 * @returns {void}
 */
function mountGhostPromptApp(): void {
  try {
    const rootElement = document.querySelector('#root');
    if (!(rootElement instanceof HTMLElement)) {
      throw new TypeError('Root element #root not found');
    }
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );
    logToHost('info', 'webview-react-mounted', { readyState: document.readyState });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logToHost('error', 'webview-react-mount-failed', { message });
    const root = document.querySelector('#root');
    if (root) {
      root.innerHTML =
        `<div style="padding:16px;font-family:var(--vscode-font-family,sans-serif);color:var(--vscode-errorForeground,#f48771);">` +
        `<h2 style="font-size:13px;margin:0 0 8px;">GhostPrompt no pudo inicializarse</h2>` +
        `<pre style="white-space:pre-wrap;font-size:12px;opacity:0.9;">${message.replaceAll('<','&lt;').replaceAll('>','&gt;')}</pre>` +
        `<button type="button" style="margin-top:12px;padding:4px 12px;background:var(--vscode-button-background,#0e639c);color:var(--vscode-button-foreground,#fff);border:none;border-radius:3px;cursor:pointer;" onclick="location.reload()">Recargar</button>` +
        `</div>`;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountGhostPromptApp, { once: true });
} else {
  mountGhostPromptApp();
}
