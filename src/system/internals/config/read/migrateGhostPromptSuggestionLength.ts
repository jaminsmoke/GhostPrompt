/**
 * @file Migración one-shot: `suggestionStyle` → `maxSuggestionChars`.
 */
import * as vscode from 'vscode';

import { SUGGESTION_LENGTH_PRESETS } from '../../protocols/constants/consSuggestionLength';

const MIGRATION_STATE_KEY = 'ghostPrompt.suggestionLengthMigrated';

const LEGACY_STYLE_TO_MAX_CHARS: Record<string, number> = {
  concise: SUGGESTION_LENGTH_PRESETS[0],
  balanced: SUGGESTION_LENGTH_PRESETS[2],
  detailed: SUGGESTION_LENGTH_PRESETS[3],
};

/**
 * Migra configuración legacy `ghostPrompt.suggestionStyle` a `maxSuggestionChars`.
 * @param {vscode.ExtensionContext} context - Contexto de extensión (globalState).
 * @returns {Promise<void>}
 */
export async function migrateGhostPromptSuggestionLengthSettings(
  context: vscode.ExtensionContext,
): Promise<void> {
  if (context.globalState.get<boolean>(MIGRATION_STATE_KEY)) {
    return;
  }
  const config = vscode.workspace.getConfiguration('ghostPrompt');
  const legacyStyle = config.get<string>('suggestionStyle');
  if (
    legacyStyle === 'concise' ||
    legacyStyle === 'balanced' ||
    legacyStyle === 'detailed'
  ) {
    const migratedMax = LEGACY_STYLE_TO_MAX_CHARS[legacyStyle];
    await config.update('maxSuggestionChars', migratedMax, vscode.ConfigurationTarget.Global);
    // eslint-disable-next-line no-undefined -- VS Code elimina la clave al recibir `undefined`.
    await config.update('suggestionStyle', undefined, vscode.ConfigurationTarget.Global);
  }
  await context.globalState.update(MIGRATION_STATE_KEY, true);
}
