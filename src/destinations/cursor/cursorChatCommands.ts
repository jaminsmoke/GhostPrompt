/**
 * Comandos IDE para abrir/rellenar el chat de Cursor (fase 0 + fase B).
 */
import * as vscode from 'vscode';
import { getLogger } from '../../system/log';

/** Prefijos usados al filtrar `vscode.commands.getCommands` en descubrimiento. */
export const CURSOR_CHAT_COMMAND_PROBE_PREFIXES = [
  'chat',
  'composer',
  'agent',
  'aichat',
  'cursor',
  'aicontext',
  'aipopup',
] as const;

/**
 * Comando principal validado para v1 (misma API que Copilot Chat en VS Code / Cursor).
 * @see Docs/Integrations/APIS/Cursor.md
 */
export const CURSOR_CHAT_PRIMARY_COMMAND_ID = 'workbench.action.chat.open';

/**
 * Filtra IDs de comando candidatos para chat/composer en Cursor.
 * @param {readonly string[]} allCommands Lista completa de `vscode.commands.getCommands`.
 * @returns {string[]} Comandos ordenados que coinciden con algún prefijo de sondeo.
 */
export function filterCursorChatCandidateCommands(allCommands: readonly string[]): string[] {
  const needles = CURSOR_CHAT_COMMAND_PROBE_PREFIXES.map((p) => p.toLowerCase());
  return [...allCommands]
    .filter((id) => {
      const lower = id.toLowerCase();
      return needles.some((n) => lower.includes(n));
    })
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Escribe en un canal de salida el resultado del sondeo de comandos (fase 0 / QA).
 * @param {vscode.OutputChannel} output Canal donde volcar la lista.
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
 * @param {string} query Texto a inyectar en el input del chat.
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
  } catch (first) {
    log.debug('cursor-chat-open-query-object-failed', {
      error: first instanceof Error ? first.message : String(first),
    });
  }

  try {
    await run(trimmed);
    return;
  } catch (second) {
    const detail = second instanceof Error ? second.message : String(second);
    throw new Error(
      `GhostPrompt: no se pudo abrir el chat de Cursor (${CURSOR_CHAT_PRIMARY_COMMAND_ID}): ${detail}`,
    );
  }
}
