/**
 * @file Envío de mensajes desde el webview React al host VS Code.
 */
import type { OutboundMessage } from '../types';

interface VsCodeApi {
  postMessage: (message: unknown) => void;
}

const globalWithVsCodeApi = globalThis as typeof globalThis & {
  acquireVsCodeApi?: () => VsCodeApi;
  __ghostPromptVsCodeApi?: VsCodeApi;
};

/**
 * Obtiene la API del webview (singleton: `acquireVsCodeApi` solo puede llamarse una vez).
 * @returns {VsCodeApi | undefined} Instancia cacheada o ausente fuera del host.
 */
export function getGhostPromptVsCodeApi(): VsCodeApi | undefined {
  if (globalWithVsCodeApi.__ghostPromptVsCodeApi) {
    return globalWithVsCodeApi.__ghostPromptVsCodeApi;
  }
  if (typeof globalWithVsCodeApi.acquireVsCodeApi !== 'function') {
    return undefined;
  }
  try {
    globalWithVsCodeApi.__ghostPromptVsCodeApi = globalWithVsCodeApi.acquireVsCodeApi();
    return globalWithVsCodeApi.__ghostPromptVsCodeApi;
  } catch {
    return undefined;
  }
}

/**
 * Envía un mensaje desde el webview React al host de VS Code.
 * @param {OutboundMessage} message - Payload outbound que se transmite al host.
 * @returns {void}
 */
export function postToHost(message: OutboundMessage): void {
  getGhostPromptVsCodeApi()?.postMessage(message);
}
