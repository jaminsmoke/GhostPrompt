/**
 * @file Comandos IDE para abrir/rellenar el chat de Cursor (fase 0 + fase B).
 * Constantes: `system/internals/protocols/constants/consCursorChat.ts`.
 */
import * as vscode from 'vscode';

import {
  CURSOR_CHAT_COMMAND_PROBE_PREFIXES,
  CURSOR_CHAT_PRIMARY_COMMAND_ID,
} from '../../system/internals/protocols/constants/consCursorChat';
import { getLogger } from '../../system/log';

/**
 * Filtra IDs de comando candidatos para chat/composer en Cursor.
 * @param {readonly string[]} allCommands - Lista completa de `vscode.commands.getCommands`.
 * @returns {string[]} Comandos ordenados que coinciden con algún prefijo de sondeo.
 */
export function filterCursorChatCandidateCommands(allCommands: readonly string[]): string[] {
  const needles = CURSOR_CHAT_COMMAND_PROBE_PREFIXES.map((p) => p.toLowerCase());
  return [...allCommands]
    .filter((id) => {
      const lower = id.toLowerCase();
      return needles.some((n) => lower.includes(n));
    })
    .toSorted((a, b) => a.localeCompare(b));
}

/**
 * Escribe en un canal de salida el resultado del sondeo de comandos (fase 0 / QA).
 * @param {vscode.OutputChannel} output - Canal donde volcar la lista.
 * @returns {Promise<void>}
 */
export async function appendCursorChatCommandDiscovery(
  output: vscode.OutputChannel,
): Promise<void> {
  const all = await vscode.commands.getCommands(true);
  const candidates = filterCursorChatCandidateCommands(all);
  const hasPrimary = all.includes(CURSOR_CHAT_PRIMARY_COMMAND_ID);

  output.appendLine('=== GhostPrompt — Cursor chat command discovery ===');
  output.appendLine(`Host appName: ${vscode.env.appName}`);
  output.appendLine(`Total commands: ${all.length}`);
  output.appendLine(
    `Primary v1: ${CURSOR_CHAT_PRIMARY_COMMAND_ID} — ${hasPrimary ? 'registered' : 'NOT FOUND'}`,
  );
  output.appendLine('');
  output.appendLine(`Candidates (${candidates.length}):`);
  for (const id of candidates) {
    output.appendLine(`  ${id}`);
  }
  output.appendLine('');
  output.appendLine(
    'Send v1 uses workbench.action.chat.open with { query } (prefill); auto-submit is out of scope.',
  );
  output.appendLine(
    'Note: workbench.action.chat.submit is often missing in Cursor (forum 2025); do not rely on it.',
  );
}

/**
 * Abre el chat nativo y rellena el prompt (no envía automáticamente).
 * @param {string} query - Texto a inyectar en el input del chat.
 * @returns {Promise<void>}
 */
export async function executeCursorChatOpen(query: string): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) {
    return;
  }

  const log = getLogger('destinations');
  const run = async (args: unknown): Promise<void> => {
    await vscode.commands.executeCommand(CURSOR_CHAT_PRIMARY_COMMAND_ID, args);
  };

  try {
    await run({ query: trimmed });
    return;
  } catch (error) {
    log.debug('cursor-chat-open-query-object-failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    await run(trimmed);
    
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `GhostPrompt: no se pudo abrir el chat de Cursor (${CURSOR_CHAT_PRIMARY_COMMAND_ID}): ${detail}`,
      { cause: error },
    );
  }
}
