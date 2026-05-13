/**
 * @fileoverview Barrel público de la integración VS Code.
 *
 * Este dominio contiene todo lo que interactúa directamente con la API de VS Code:
 * providers de vistas, generación de HTML/CSP para webviews, y notificaciones host.
 *
 * No debe contener lógica de suggestion, contratos Zod, ni orquestación de pipeline.
 */

export { MiniInputViewProvider } from "./MiniInputViewProvider";
export {
  buildGhostPromptWebviewHtml,
  generateGhostPromptWebviewNonce,
  type GhostPromptWebviewHtmlParams,
} from "./webviewHtml";
export { maybeNotifySuggestionIssue } from "./suggestionNotification";
