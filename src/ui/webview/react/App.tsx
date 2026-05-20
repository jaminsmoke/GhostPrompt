/// <reference types="vite/client" />

/**
 * @file Punto de entrada React del webview GhostPrompt (enruta chat vs hub).
 */
export { postToHost } from './hooks/ghostPromptPostMessage';
import { GhostPromptRoot } from './surfaces/GhostPromptRoot';

/**
 * Raíz del webview: delega en {@link GhostPromptRoot} según `window.__ghostPromptViewId`.
 * @returns {import('react').JSX.Element} Superficie chat o hub.
 */
export function App() {
  return <GhostPromptRoot />;
}
