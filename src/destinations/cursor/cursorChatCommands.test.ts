/**
 * @file Pruebas unitarias del componente de comandos de Cursor Chat.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  commands: { executeCommand: vi.fn(), getCommands: vi.fn(() => Promise.resolve([])) },
  env: { appName: 'Cursor' },
  window: { createOutputChannel: vi.fn(() => ({ appendLine: vi.fn(), show: vi.fn(), clear: vi.fn() })) },
}));

vi.mock('../../system/log', () => ({
  getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import {
  CURSOR_CHAT_PRIMARY_COMMAND_ID,
  filterCursorChatCandidateCommands,
} from './cursorChatCommands';

describe('cursorChatCommands', () => {
  it('filterCursorChatCandidateCommands incluye chat/composer/cursor y ordena', () => {
    const all = [
      'workbench.action.files.save',
      'workbench.action.chat.open',
      'aichat.newchataction',
      'composer.openComposer',
      'cursor.foo',
      'ghostPrompt.runSuggestPipeline',
    ];
    expect(filterCursorChatCandidateCommands(all)).toEqual([
      'aichat.newchataction',
      'composer.openComposer',
      'cursor.foo',
      'workbench.action.chat.open',
    ]);
  });

  it('expone el comando primario acordado en fase 0', () => {
    expect(CURSOR_CHAT_PRIMARY_COMMAND_ID).toBe('workbench.action.chat.open');
  });
});
