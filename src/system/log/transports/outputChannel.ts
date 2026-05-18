/**
 * @file Transporte: canal de salida VS Code **GhostPrompt Log**.
 */
import * as vscode from 'vscode';

import { clearOptionalProperty } from '../../internals/isDefined';

import type { LogEntry } from '../types';

/** Nombre visible del canal (histórico: *GhostPrompt Suggestions*). */
export const GHOSTPROMPT_LOG_CHANNEL_NAME = 'GhostPrompt Log';

const TIME_FIELD_PAD_WIDTH = 2;
const TIME_MS_FIELD_PAD_WIDTH = 3;

/**
 * Formatea marca de tiempo ISO a `HH:mm:ss.SSS` local.
 * @param {string} iso - Fecha ISO 8601.
 * @returns {string} Fragmento horario legible.
 */
export function formatLocalTime(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(TIME_FIELD_PAD_WIDTH, '0');
  const mm = d.getMinutes().toString().padStart(TIME_FIELD_PAD_WIDTH, '0');
  const ss = d.getSeconds().toString().padStart(TIME_FIELD_PAD_WIDTH, '0');
  const ms = d.getMilliseconds().toString().padStart(TIME_MS_FIELD_PAD_WIDTH, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

/**
 * Serializa `data` para anexarlo a la línea de log; ante fallo devuelve un literal seguro.
 * @param {Record<string, unknown>} data - Metadatos del evento.
 * @returns {string} JSON o cadena de marcador de posición.
 */
function safeJson(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data);
  } catch {
    return '"[unserializable]"';
  }
}

/**
 * Escribe líneas de texto en un {@link vscode.OutputChannel} (append síncrono, bajo coste).
 * Crea el canal bajo demanda la primera vez que se escribe.
 */
export class OutputChannelLogTransport {
  /** @readonly */
  readonly id = 'ghostPromptOutputChannel';

  private channel: vscode.OutputChannel | undefined;

  /**
   * Crea el canal si aún no existe (idempotente).
   * @returns {vscode.OutputChannel} Canal listo para `appendLine`.
   */
  ensureChannel(): vscode.OutputChannel {
    this.channel ??= vscode.window.createOutputChannel(GHOSTPROMPT_LOG_CHANNEL_NAME);
    return this.channel;
  }

  /**
   * Serializa una entrada a una línea humana.
   * @param {LogEntry} entry - Entrada estructurada.
   * @returns {string} Línea para `appendLine`.
   */
  formatLine(entry: LogEntry): string {
    const t = formatLocalTime(entry.timestamp);
    const data =
      entry.data && Object.keys(entry.data).length > 0 ? ` | ${safeJson(entry.data)}` : '';
    const err = entry.error
      ? ` | ${entry.error.name}: ${entry.error.message}${
          entry.error.stack ? `\n${entry.error.stack}` : ''
        }`
      : '';
    const crumbs =
      entry.breadcrumbs && entry.breadcrumbs.length > 0
        ? ` | breadcrumbs=${entry.breadcrumbs.length}`
        : '';
    return `[${t}] [${entry.level}] [${entry.module}] ${entry.message}${data}${crumbs}${err}`;
  }

  /**
   * Añade una línea legible al canal GhostPrompt Log.
   * @param {LogEntry} entry - Entrada a volcar al canal.
   * @returns {Promise<void>} Promesa resuelta tras `appendLine`.
   */
  write(entry: LogEntry): Promise<void> {
    this.ensureChannel().appendLine(this.formatLine(entry));
    return Promise.resolve();
  }

  /**
   * Libera el canal de salida si se había creado.
   * @returns {Promise<void>} Promesa resuelta tras `dispose` del canal si existía.
   */
  dispose(): Promise<void> {
    this.channel?.dispose();
    clearOptionalProperty(this, 'channel');
    return Promise.resolve();
  }
}
