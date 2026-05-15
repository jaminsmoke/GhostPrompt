/**
 * @file APIs globales del webview VS Code (no exportadas por `@types/vscode` para el panel web).
 */

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

interface GhostPromptCapabilities {
  compactToolbar?: boolean;
}

interface Window {
  __ghostPromptViewId?: string;
  __ghostPromptCapabilities?: GhostPromptCapabilities;
}

declare module '*.css';
