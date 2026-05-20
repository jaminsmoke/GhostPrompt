/**
 * @file Detección de host Cursor Desktop (roadmap v0.6 destino `cursorChat`, fase A).
 */
import * as vscode from 'vscode';

/**
 * Indica si la extensión corre dentro de Cursor IDE (no VS Code puro).
 * Usado para exponer el destino en settings/UI cuando aplique (fase C).
 * @returns {boolean} True si `vscode.env.appName` contiene "cursor".
 */
export function isCursorDesktopHost(): boolean {
  try {
    const appName = vscode.env.appName.toLowerCase();
    return appName.includes('cursor');
  } catch {
    return false;
  }
}

export {CURSOR_CHAT_DESTINATION_ID} from '../../system/internals/protocols/constants/consDestinations';