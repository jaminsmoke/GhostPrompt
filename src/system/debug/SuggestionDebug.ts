import * as vscode from 'vscode';

const DEBUG_SETTING_KEY = 'debugSuggestions';
const OUTPUT_CHANNEL_NAME = 'GhostPrompt Suggestions';

let outputChannel: vscode.OutputChannel | undefined;

/**
 * Asegura que el canal de salida de debug exista.
 */
function ensureDebugOutputChannel(): void {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  }
}

/**
 * Añade una línea al canal de salida de debug.
 * @param line Línea de texto de debug.
 */
function appendDebugLine(line: string): void {
  ensureDebugOutputChannel();
  outputChannel?.appendLine(line);
}

/**
 * Comprueba si el logging de suggestions está habilitado en la configuración.
 * @returns True cuando `ghostPrompt.debugSuggestions` está activo.
 */
export function isSuggestionDebugEnabled(): boolean {
  return vscode.workspace.getConfiguration('ghostPrompt').get<boolean>(DEBUG_SETTING_KEY, false);
}

/**
 * Alterna la configuración de logging de suggestions.
 * @returns El nuevo valor de activación.
 */
export async function toggleSuggestionDebug(): Promise<boolean> {
  const config = vscode.workspace.getConfiguration('ghostPrompt');
  const current = config.get<boolean>(DEBUG_SETTING_KEY, false);
  const next = !current;
  await config.update(DEBUG_SETTING_KEY, next, vscode.ConfigurationTarget.Global);

  if (next) {
    const timestamp = new Date().toISOString();
    appendDebugLine(
      `[${timestamp}] [debug] GhostPrompt debug logging enabled. Open the 'GhostPrompt Suggestions' output channel to view logs.`,
    );
  }

  return next;
}

/**
 * Crea el canal de debug si la depuración de suggestions está habilitada.
 */
export function ensureSuggestionDebugChannel(): void {
  if (isSuggestionDebugEnabled()) {
    ensureDebugOutputChannel();
  }
}

/**
 * Registra un mensaje informativo en el canal de debug.
 * @param message Mensaje de debug a registrar.
 */
export function logDebugInfo(message: string): void {
  if (!isSuggestionDebugEnabled()) {
    return;
  }
  const timestamp = new Date().toISOString();
  appendDebugLine(`[${timestamp}] [debug] ${message}`);
}

/**
 * Registra un evento de debug específico de suggestion.
 * @param captureId Identificador de captura para correlación.
 * @param stage Fase o nombre del evento de sugerencia.
 * @param details Detalles adicionales opcionales.
 */
export function logSuggestionDebug(captureId: number, stage: string, details?: string): void {
  if (!isSuggestionDebugEnabled()) {
    return;
  }

  const timestamp = new Date().toISOString();
  const suffix = details ? ` | ${details}` : '';
  appendDebugLine(`[${timestamp}] [capture:${captureId}] [${stage}]${suffix}`);
}

/**
 * Registra depuración de eventos de OpenCode.
 * @param stage Fase o paso actual del ciclo de vida de OpenCode.
 * @param details Detalles adicionales opcionales.
 */
export function logOpenCodeDebug(stage: string, details?: string): void {
  if (!isSuggestionDebugEnabled()) {
    return;
  }

  const timestamp = new Date().toISOString();
  const suffix = details ? ` | ${details}` : '';
  appendDebugLine(`[${timestamp}] [opencode] [${stage}]${suffix}`);
}

/**
 * Registra timings de rendimiento para capturas OpenCode.
 * @param captureId Identificador de captura opcional.
 * @param phase Fase de desempeño dentro del ciclo OpenCode.
 * @param details Detalles adicionales opcionales.
 */
export function logOpenCodePerfCapture(
  captureId: number | undefined,
  phase: string,
  details?: string,
): void {
  if (!isSuggestionDebugEnabled()) {
    return;
  }
  const timestamp = new Date().toISOString();
  const capLabel = captureId === undefined ? '—' : String(captureId);
  const suffix = details ? ` | ${details}` : '';
  appendDebugLine(`[${timestamp}] [capture:${capLabel}] [opencode-perf] [${phase}]${suffix}`);
}
