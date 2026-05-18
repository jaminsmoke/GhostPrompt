/**
 * @file Singleton de logging: niveles efectivos, breadcrumbs y transports.
 */
import * as vscode from 'vscode';

import { hasAnyConfigurationInspectScope, isDefined } from '../internals/isDefined';

import { CaptureBreadcrumbStore } from './breadcrumbs';
import { parseLogLevelString, shouldEmit, type LogLevelName } from './levels';
import { Logger } from './Logger';
import { LOG_FILE_ROTATE_MAX_BYTES, LOG_LEGACY_MD_PREVIEW_MAX_CHARS } from './logLimits';
import { QueuedNdjsonFileTransport } from './transports/file';
import { OutputChannelLogTransport } from './transports/outputChannel';

import type { EmitPayload, LogEmitSink } from './emitContract';
import type { LogEntry, LogTransport } from './types';

/**
 * Resuelve el nivel mínimo visible según `logLevel` explícito o shim `debugSuggestions`.
 * @param {vscode.WorkspaceConfiguration} cfg - Sección `ghostPrompt` de VS Code.
 * @returns {LogLevelName} Umbral aplicado a transports.
 */
export function resolveEffectiveMinLevelName(
  cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('ghostPrompt'),
): LogLevelName {
  const inspected = cfg.inspect<string>('logLevel');
  const explicit = hasAnyConfigurationInspectScope(inspected);
  if (explicit) {
    return parseLogLevelString(cfg.get<string>('logLevel', 'info'));
  }
  if (cfg.get<boolean>('debugSuggestions', false)) {
    return 'DEBUG';
  }
  return 'INFO';
}

/**
 * Serializa un valor desconocido a la forma `error` de `LogEntry`.
 * @param {unknown} err - Valor lanzado o pasado como `cause`.
 * @returns {NonNullable<LogEntry['error']>} Objeto con nombre, mensaje y stack si aplica.
 */
function toErrorPayload(err: unknown): NonNullable<LogEntry['error']> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: 'Error', message: String(err) };
}

/**
 * Obtiene `captureId` numérico de `data` si existe y es finito.
 * @param {Record<string, unknown>} [data] - Metadatos opcionales del evento.
 * @returns {number | undefined} Identificador o `undefined`.
 */
function extractCaptureId(data?: Record<string, unknown>): number | false {
  if (!data) {
    return false;
  }
  const v = data.captureId;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v;
  }
  return false;
}

const logManagerSlot: { current?: LogManager } = {};

/**
 * Devuelve la instancia activa del singleton de logging.
 * @returns {LogManager | undefined} Instancia activa o ausente.
 */
function getLogManagerSingleton(): LogManager | undefined {
  return logManagerSlot.current;
}

/**
 * Registra la instancia activa del singleton de logging.
 * @param {LogManager} next - Instancia a registrar.
 * @returns {void}
 */
function setLogManagerSingleton(next: LogManager): void {
  logManagerSlot.current = next;
}

/**
 * Elimina la instancia activa del singleton de logging.
 * @returns {void}
 */
function clearLogManagerSingleton(): void {
  delete logManagerSlot.current;
}

const inactiveSink: LogEmitSink = {
  emit() {
    /* sink inactivo antes de initGhostPromptLogging */
  },
};
const inactiveLoggers = new Map<string, Logger>();

/**
 * Inicializa transports y suscripciones (idempotente).
 * @param {vscode.ExtensionContext} context - Contexto de activación de la extensión.
 * @returns {void} Sin valor de retorno.
 */
export function initGhostPromptLogging(context: vscode.ExtensionContext): void {
  if (getLogManagerSingleton()) {
    return;
  }
  setLogManagerSingleton(new LogManager(context));
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('ghostPrompt')) {
        getLogManagerSingleton()?.touchConfig();
      }
    }),
    new vscode.Disposable(() => {
      getLogManagerSingleton()?.disposeAll().catch(() => {
        /* ignore */
      });
      clearLogManagerSingleton();
    }),
  );
}

/**
 * Cierra transports y libera el singleton.
 * @returns {Promise<void>} Promesa que termina cuando los transports se han cerrado.
 */
export async function disposeGhostPromptLogging(): Promise<void> {
  const active = getLogManagerSingleton();
  clearLogManagerSingleton();
  await active?.disposeAll();
}

/**
 * Obtiene el logger de un módulo (no registra hasta `initGhostPromptLogging`).
 * @param {string} moduleName - Nombre estable (`suggest`, `inbound`, …).
 * @returns {Logger} Instancia reutilizada por módulo.
 */
export function getLogger(moduleName: string): Logger {
  const active = getLogManagerSingleton();
  if (!active) {
    let l = inactiveLoggers.get(moduleName);
    if (!l) {
      l = new Logger(moduleName, inactiveSink);
      inactiveLoggers.set(moduleName, l);
    }
    return l;
  }
  return active.getLoggerInstance(moduleName);
}

/**
 * Vacía el anillo de migajas de un `captureId` (por ejemplo, al terminar el pipeline).
 * @param {number} captureId - Identificador de correlación.
 * @returns {void} Sin valor de retorno.
 */
export function flushLogCapture(captureId: number): void {
  getLogManagerSingleton()?.flushCaptureInternal(captureId);
}

/**
 * Indica si el umbral efectivo es `DEBUG` (UI y webview de ajustes).
 * @returns {boolean} Verdadero si el usuario vería logs de depuración.
 */
export function isSuggestionDebugEnabled(): boolean {
  return resolveEffectiveMinLevelName() === 'DEBUG';
}

/**
 * Alterna `ghostPrompt.debugSuggestions` (compatibilidad con el comando existente).
 * @returns {Promise<boolean>} Nuevo valor del booleano.
 */
export async function toggleSuggestionDebug(): Promise<boolean> {
  const config = vscode.workspace.getConfiguration('ghostPrompt');
  const current = config.get<boolean>('debugSuggestions', false);
  const next = !current;
  await config.update('debugSuggestions', next, vscode.ConfigurationTarget.Global);
  if (next) {
    getLogManagerSingleton()?.ensureOutputChannel();
    getLogger('extension').info('debug-shim-enabled', {
      hint: 'Open GhostPrompt Log output channel for structured logs.',
    });
  }
  return next;
}

/**
 * Crea el canal de salida si hace falta, por ejemplo al arrancar con la depuración activa.
 * @returns {void} Sin valor de retorno.
 */
export function ensureSuggestionDebugChannel(): vscode.OutputChannel | undefined {
  return getLogManagerSingleton()?.ensureOutputChannel();
}

/**
 * Registra tiempos de OpenCode en nivel DEBUG (sustituye `logOpenCodePerfCapture` legacy).
 * @param {number | undefined} captureId - Identificador de correlación opcional.
 * @param {string} phase - Fase de medición.
 * @param {string} [details] - Detalle libre (por ejemplo, `elapsedMs=12`).
 * @returns {void} Sin valor de retorno.
 */
export function logOpenCodePerfCapture(
  captureId: number | undefined,
  phase: string,
  details?: string,
): void {
  getLogger('engines').debug('opencode-perf', {
    captureId,
    phase,
    details: details ?? '',
  });
}

/**
 * Registra depuración OpenCode en nivel DEBUG (sustituye `logOpenCodeDebug` legacy).
 * @param {string} stage - Etapa del flujo.
 * @param {string} [details] - Detalle opcional.
 * @returns {void} Sin valor de retorno.
 */
export function logOpenCodeDebug(stage: string, details?: string): void {
  getLogger('engines').debug('opencode', { stage, details: details ?? '' });
}

/**
 * Gestor interno que implementa {@link LogEmitSink} y despacha a los transports registrados.
 */
class LogManager implements LogEmitSink {
  private readonly crumbs = new CaptureBreadcrumbStore();
  private readonly outputTransport = new OutputChannelLogTransport();
  private readonly fileTransport: QueuedNdjsonFileTransport;
  private readonly transports: LogTransport[] = [];
  private readonly loggers = new Map<string, Logger>();

  /**
   * Arranca transports de archivo y de canal, y programa la migración best-effort de Markdown legacy.
   * @param {vscode.ExtensionContext} context - Contexto de extensión (almacenamiento global y opcional por workspace).
   */
  constructor(private readonly context: vscode.ExtensionContext) {
    const logsDirectory = vscode.Uri.joinPath(context.globalStorageUri, 'ghostPrompt', 'logs', 'v1');
    this.fileTransport = new QueuedNdjsonFileTransport(
      logsDirectory,
      () => vscode.workspace.getConfiguration('ghostPrompt').get<boolean>('logFileEnabled', true),
      () =>
        vscode.workspace
          .getConfiguration('ghostPrompt')
          .get<number>('logFileMaxBytes', LOG_FILE_ROTATE_MAX_BYTES),
    );
    this.transports.push(this.outputTransport, this.fileTransport);
    this.runLegacyMarkdownMigration(logsDirectory).catch(() => {
      // Best-effort: no bloquear activate.
    });
  }

  /**
   * Importa una sola vez los ficheros Markdown legacy hacia NDJSON como eventos `migration/legacy-md-snapshot`.
   * Usa `storageUri` y `globalStorageUri` como bases de lectura, sin aplicar el filtro de nivel al escribir.
   * @param {vscode.Uri} logsDirectory - Directorio `ghostPrompt/logs/v1`.
   * @returns {Promise<void>} Promesa que termina tras leer y escribir el marcador de importación.
   */
  private async runLegacyMarkdownMigration(logsDirectory: vscode.Uri): Promise<void> {
    const flagUri = vscode.Uri.joinPath(logsDirectory, '.legacy-md-imported.json');
    try {
      await vscode.workspace.fs.stat(flagUri);
      return;
    } catch {
      // No importado aún.
    }
    const bases = new Map<string, vscode.Uri>();
    if (this.context.storageUri) {
      bases.set(this.context.storageUri.toString(), this.context.storageUri);
    }
    bases.set(this.context.globalStorageUri.toString(), this.context.globalStorageUri);

    const legacyTargets = [...bases.values()].flatMap((base) =>
      (['suggestions.md', 'conversation.md'] as const).map((fileName) => ({ base, fileName })),
    );
    const snapshotGroups = await Promise.all(
      legacyTargets.map(async ({ base, fileName }): Promise<LogEntry[]> => {
        const fileUri = vscode.Uri.joinPath(base, fileName);
        try {
          const bytes = await vscode.workspace.fs.readFile(fileUri);
          const text = Buffer.from(bytes).toString('utf8').trim();
          if (text.length === 0) {
            return [];
          }
          return [
            {
              timestamp: new Date().toISOString(),
              level: 'INFO',
              module: 'migration',
              message: 'legacy-md-snapshot',
              data: {
                fileName,
                source: base.toString(),
                charCount: text.length,
                preview: text.slice(0, LOG_LEGACY_MD_PREVIEW_MAX_CHARS),
              },
            },
          ];
        } catch {
          return [];
        }
      }),
    );
    const entries: LogEntry[] = snapshotGroups.flat();
    for (const e of entries) {
      this.fileTransport.write(e).catch(() => {
        /* ignore */
      });
    }
    try {
      await vscode.workspace.fs.createDirectory(logsDirectory);
      await vscode.workspace.fs.writeFile(
        flagUri,
        Buffer.from(
          JSON.stringify({
            importedAt: new Date().toISOString(),
            snapshots: entries.length,
          }),
          'utf8',
        ),
      );
    } catch {
      // Flag opcional; la próxima activación podría reintentar si falla solo el write del flag.
    }
  }

  /**
   * Marca posible refresco de configuración (reservado; el umbral se lee en caliente hoy).
   * @returns {void} Sin valor de retorno.
   */
  touchConfig(): void {
    // Reservado para cachear umbral si hiciera falta.
  }

  /**
   * Devuelve o crea el `Logger` singleton por nombre de módulo.
   * @param {string} moduleName - Nombre del módulo.
   * @returns {Logger} Instancia reutilizada.
   */
  getLoggerInstance(moduleName: string): Logger {
    let l = this.loggers.get(moduleName);
    if (!l) {
      l = new Logger(moduleName, this);
      this.loggers.set(moduleName, l);
    }
    return l;
  }

  /**
   * Garantiza que exista el canal de salida GhostPrompt Log.
   * @returns {void} Sin valor de retorno.
   */
  ensureOutputChannel(): vscode.OutputChannel {
    return this.outputTransport.ensureChannel();
  }

  /**
   * Elimina el anillo de migajas interno para un `captureId`.
   * @param {number} captureId - Identificador de correlación.
   * @returns {void} Sin valor de retorno.
   */
  flushCaptureInternal(captureId: number): void {
    this.crumbs.flushCapture(captureId);
  }

  /**
   * Materializa `LogEntry`, actualiza migajas y escribe en todos los transports.
   * @param {EmitPayload} payload - Carga cruda del logger.
   * @returns {void} Sin valor de retorno.
   */
  emit(payload: EmitPayload): void {
    const min = resolveEffectiveMinLevelName();
    if (!shouldEmit(payload.level, min)) {
      return;
    }
    const timestamp = new Date().toISOString();
    const captureId = extractCaptureId(payload.data);
    const warnOrError = payload.level === 'WARN' || payload.level === 'ERROR';
    const breadcrumbPayload =
      warnOrError && captureId !== false ? { breadcrumbs: this.crumbs.snapshot(captureId) } : {};
    const errorPayload = isDefined(payload.cause) ? { error: toErrorPayload(payload.cause) } : {};
    const entry: LogEntry = {
      timestamp,
      level: payload.level,
      module: payload.module,
      message: payload.message,
      data: payload.data,
      ...breadcrumbPayload,
      ...errorPayload,
    };
    if (captureId !== false) {
      this.crumbs.push(captureId, {
        level: payload.level,
        message: payload.message,
        timestamp,
        data: payload.data,
      });
    }
    for (const t of this.transports) {
      t.write(entry).catch(() => {
        /* ignore */
      });
    }
  }

  /**
   * Cierra y vacía todos los transports (incluida la cola del fichero NDJSON).
   * @returns {Promise<void>} Promesa que termina cuando los transports han finalizado.
   */
  async disposeAll(): Promise<void> {
    await Promise.all(this.transports.map((transport) => transport.dispose()));
  }
}
