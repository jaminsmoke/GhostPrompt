/**
 * @file Envío de mensajes desde el webview React al host VS Code.
 */
import type { OutboundMessage } from '../types';

interface VsCodeApi {
  postMessage: (message: unknown) => void;
}

const globalWithVsCodeApi = globalThis as typeof globalThis & {
  acquireVsCodeApi?: () => VsCodeApi;
};

/**
 * Envía un mensaje desde el webview React al host de VS Code.
 * @param {OutboundMessage} message - Payload outbound que se transmite al host.
 * @returns {void}
 */
export function postToHost(message: OutboundMessage): void {
  if (typeof globalWithVsCodeApi.acquireVsCodeApi !== 'function') {
    return;
  }
  globalWithVsCodeApi.acquireVsCodeApi().postMessage(message);
}
