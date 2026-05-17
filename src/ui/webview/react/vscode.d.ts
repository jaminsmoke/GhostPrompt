/**
 * @file Declaraciones globales de VS Code para el webview React.
 */


declare global {
  function acquireVsCodeApi(): {
    postMessage(message: unknown): void;
    setState(state: unknown): void;
    getState(): unknown;
  };
}
