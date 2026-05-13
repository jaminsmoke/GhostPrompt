export {};

declare global {
  function acquireVsCodeApi(): {
    postMessage(message: unknown): void;
    setState(state: unknown): void;
    getState(): unknown;
  };
}
