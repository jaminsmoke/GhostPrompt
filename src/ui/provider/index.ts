/**
 * @file Barrel del proveedor de vista webview GhostPrompt.
 */
export { MiniInputViewProvider } from './MiniInputViewProvider';
export {
  buildGhostPromptWebviewFaultHtml,
  buildGhostPromptWebviewHtml,
  generateGhostPromptWebviewNonce,
  type GhostPromptWebviewHtmlParameters,
} from './webviewHtml';
export {
  getMultiViewDraftText,
  resetMultiViewDraftText,
  setMultiViewDraftText,
} from './multiViewDraft';
