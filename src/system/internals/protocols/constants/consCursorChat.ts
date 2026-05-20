/**
 * @file Constantes de integración GhostPrompt ↔ chat nativo de Cursor (comandos VS Code).
 */

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
