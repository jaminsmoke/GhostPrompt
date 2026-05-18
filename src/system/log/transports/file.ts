/**
 * @file Transporte: NDJSON + Markdown bajo `globalStorageUri/ghostPrompt/logs/v1/` con cola asíncrona.
 */
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';

import * as vscode from 'vscode';

import type { LogEntry } from '../types';

const gzipAsync = promisify(gzip);

const EVENTS_FILE = 'events.ndjson';
const SESSION_FILE = 'session.md';

const DEFAULT_MAX_QUEUE = 2000;
const FLUSH_BATCH = 100;

/**
 * Encola entradas y vacía a disco sin bloquear al caller (micro-lotes).
 * Aplica rotación gzip del NDJSON cuando supera el tamaño máximo configurado.
 */
export class QueuedNdjsonFileTransport {
  /** @readonly */
  readonly id = 'ghostPromptFileNdjson';

  private readonly queue: LogEntry[] = [];
  private flushScheduled = false;
  private flushing = false;
  private droppedDebug = 0;
  private warnedBackpressure = false;
  private writeErrors = 0;

  /**
   * Configura el directorio de logs y los lectores perezosos de ajustes.
   * @param {vscode.Uri} logsDirectory - Directorio `.../ghostPrompt/logs/v1`.
   * @param {() => boolean} isFileLogEnabled - Lectura perezosa de `ghostPrompt.logFileEnabled`.
   * @param {() => number} getMaxBytes - Lectura perezosa de `ghostPrompt.logFileMaxBytes`.
   * @param {number} [maxQueue] - Tamaño máximo de cola antes de descartar `DEBUG`.
   */
  constructor(
    private readonly logsDirectory: vscode.Uri,
    private readonly isFileLogEnabled: () => boolean,
    private readonly getMaxBytes: () => number,
    private readonly maxQueue: number = DEFAULT_MAX_QUEUE,
  ) {}

  /**
   * Expone el número acumulado de fallos de escritura en disco.
   * @returns {number} Contador de errores de escritura (visible para tests y diagnóstico).
   */
  getWriteErrorCount(): number {
    return this.writeErrors;
  }

  /**
   * Encola una entrada para volcado asíncrono a NDJSON y Markdown.
   * @param {LogEntry} entry - Entrada a encolar.
   * @returns {Promise<void>} Promesa que resuelve tras encolar (no espera al vaciado en disco).
   */
  write(entry: LogEntry): Promise<void> {
    if (!this.isFileLogEnabled()) {
      return Promise.resolve();
    }
    if (this.queue.length >= this.maxQueue) {
      const idx = this.queue.findIndex((e) => e.level === 'DEBUG');
      if (idx === -1) {
        this.queue.shift();
      } else {
        this.queue.splice(idx, 1);
        this.droppedDebug += 1;
      }
      if (!this.warnedBackpressure && this.droppedDebug > 10) {
        this.warnedBackpressure = true;
        process.stderr.write(
          `[GhostPrompt] Log file queue backpressure: dropped DEBUG entries (count=${this.droppedDebug}).\n`,
        );
      }
    }
    this.queue.push(entry);
    this.scheduleFlush();
    return Promise.resolve();
  }

  /**
   * Vacía la cola pendiente y deja de aceptar trabajo nuevo.
   * @returns {Promise<void>} Promesa que termina cuando la cola está vacía.
   */
  async dispose(): Promise<void> {
    const drainQueue = async (): Promise<void> => {
      if (this.queue.length === 0 && !this.flushing) {
        return;
      }
      await this.flushOnce();
      await drainQueue();
    };
    await drainQueue();
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) {
      return;
    }
    this.flushScheduled = true;
    queueMicrotask(() => {
      this.flushScheduled = false;
      this.flushOnce().catch(() => {
        /* ignore */
      });
    });
  }

  private async flushOnce(): Promise<void> {
    if (this.flushing || this.queue.length === 0) {
      return;
    }
    if (!this.isFileLogEnabled()) {
      this.queue.length = 0;
      return;
    }
    this.flushing = true;
    try {
      const batch: LogEntry[] = [];
      while (batch.length < FLUSH_BATCH && this.queue.length > 0) {
        const e = this.queue.shift();
        if (e) {
          batch.push(e);
        }
      }
      if (batch.length === 0) {
        return;
      }
      await vscode.workspace.fs.createDirectory(this.logsDirectory);
      await this.appendNdjsonBatch(batch);
      await this.appendMarkdownBatch(batch);
      if (this.queue.length > 0) {
        this.scheduleFlush();
      }
    } catch (error) {
      this.writeErrors += 1;
      process.stderr.write(`[GhostPrompt] File log transport write failed ${String(error)}\n`);
    } finally {
      this.flushing = false;
    }
  }

  private async appendNdjsonBatch(batch: LogEntry[]): Promise<void> {
    const ndjsonUri = vscode.Uri.joinPath(this.logsDirectory, EVENTS_FILE);
    await this.maybeRotate(ndjsonUri);
    const lines = batch.map((b) => `${JSON.stringify(b)}\n`).join('');
    let existing = Buffer.alloc(0);
    try {
      existing = Buffer.from(await vscode.workspace.fs.readFile(ndjsonUri));
    } catch {
      // archivo nuevo
    }
    const next = Buffer.concat([existing, Buffer.from(lines, 'utf8')]);
    await vscode.workspace.fs.writeFile(ndjsonUri, next);
  }

  private async maybeRotate(ndjsonUri: vscode.Uri): Promise<void> {
    let size: number;
    try {
      const { size: fileSize } = await vscode.workspace.fs.stat(ndjsonUri);
      size = fileSize;
    } catch {
      size = 0;
    }
    const maxBytes = this.getMaxBytes();
    if (size < maxBytes) {
      return;
    }
    try {
      const raw = await vscode.workspace.fs.readFile(ndjsonUri);
      const stamp = new Date().toISOString().replaceAll(':', '-');
      const gzUri = vscode.Uri.joinPath(this.logsDirectory, `events.${stamp}.ndjson.gz`);
      const gzipped = await gzipAsync(raw);
      await vscode.workspace.fs.writeFile(gzUri, gzipped);
      await vscode.workspace.fs.delete(ndjsonUri, { useTrash: false });
    } catch (error) {
      this.writeErrors += 1;
      process.stderr.write(`[GhostPrompt] events.ndjson rotation failed ${String(error)}\n`);
    }
  }

  private async appendMarkdownBatch(batch: LogEntry[]): Promise<void> {
    const mdUri = vscode.Uri.joinPath(this.logsDirectory, SESSION_FILE);
    const parts: string[] = [];
    for (const e of batch) {
      const data =
        e.data && Object.keys(e.data).length > 0
          ? `\n${Object.entries(e.data)
              .map(
                ([k, v]) =>
                  `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`,
              )
              .join('\n')}\n`
          : '\n';
      parts.push(`### ${e.level} ${e.module} ${e.message}\n${data}\n`);
    }
    const block = parts.join('');
    let existing: string;
    try {
      existing = Buffer.from(await vscode.workspace.fs.readFile(mdUri)).toString('utf8');
    } catch {
      existing = '# GhostPrompt Log\n\n';
    }
    const next = existing + block;
    await vscode.workspace.fs.writeFile(mdUri, Buffer.from(next, 'utf8'));
  }
}
