/**
 * @file Enrutador de superficie webview (chat vs hub) según `window.__ghostPromptViewId`.
 */
import { resolveGhostPromptWebviewSurface } from '../ghostPromptViewIds';

import { ChatApp } from './chat/ChatApp';
import { HubApp } from './hub/HubApp';

/**
 * Monta la superficie adecuada para la vista webview actual.
 * @returns {import('react').JSX.Element} Chat o hub.
 */
export function GhostPromptRoot() {
  const surface = resolveGhostPromptWebviewSurface();
  if (surface === 'hub') {
    return <HubApp />;
  }
  return <ChatApp />;
}
