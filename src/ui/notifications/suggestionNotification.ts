/**
 * Avisos no intrusivos en el host cuando fallan sugerencias por causas accionables.
 * La UI del webview sigue siendo la fuente principal; esto complementa sin sustituir el debug.
 */
import * as vscode from 'vscode';

import type { CompletionResult } from '../../core/types';

const THROTTLE_MS = 90_000;
const lastShownAt = new Map<string, number>();

/** Solo para tests — vacía el throttle entre casos. */
export function resetSuggestionHostNotificationThrottleForTests(): void {
  lastShownAt.clear();
}

/**
 * Comprueba si las notificaciones de issue de sugerencias están habilitadas.
 * @returns {boolean} True si deben mostrarse avisos de sugerencia en el host.
 */
function notificationsEnabled(): boolean {
  return (
    vscode.workspace
      .getConfiguration('ghostPrompt')
      .get<boolean>('showSuggestionIssueNotifications', true) !== false
  );
}

/**
 * Determina si se puede mostrar una notificación con throttle.
 * @param {string} key Clave de evento para evitar repetición rápida.
 * @returns {boolean} True si la notificación puede mostrarse.
 */
function shouldShow(key: string): boolean {
  const now = Date.now();
  const prev = lastShownAt.get(key);
  if (prev !== undefined && now - prev < THROTTLE_MS) {
    return false;
  }
  lastShownAt.set(key, now);
  return true;
}

/**
 * Muestra un aviso en el host cuando procede y pasa el throttle.
 * @param {string} text Texto de notificación mostrado al usuario.
 * @param {string} key Clave de notificación para el throttle.
 * @returns {void}
 */
function notify(text: string, key: string): void {
  if (!shouldShow(key)) {
    return;
  }
  void vscode.window.showWarningMessage(`GhostPrompt: ${text}`);
}

type EmptyReason = Extract<CompletionResult, { kind: 'empty' }>['reason'];

/**
 * Obtiene un hint de UI para razones de resultado vacío.
 * @param {EmptyReason} reason Motivo de resultado vacío.
 * @returns {string | null} Mensaje de ayuda o null si no hay hint aplicable.
 */
function hostHintForEmptyReason(reason: EmptyReason): string | null {
  switch (reason) {
    case 'no-model':
      return 'No hay motor de sugerencias (Copilot u OpenCode). Revisa fuentes en configuración.';
    case 'no-included-model':
      return 'No hay modelo incluido disponible; revisa la política de modelo o el selector.';
    case 'premium-quota-blocked':
      return 'Cuota premium agotada: el modo solo incluido está pausando sugerencias.';
    default:
      return null;
  }
}

/**
 * Traduce mensajes de error técnicos a hints de usuario.
 * @param {string} message Mensaje de error recibido de la sugerencia.
 * @returns {string | null} Texto de hint o null si no se reconoce el error.
 */
function hostHintForErrorMessage(message: string): string | null {
  const lower = message.toLowerCase();
  if (
    lower.includes('premium model quota') ||
    lower.includes('additional paid premium') ||
    lower.includes('allowance to renew')
  ) {
    return 'Cuota de modelo premium agotada o limitada. Elige un modelo incluido o revisa Copilot.';
  }
  if (lower.includes('failed to start opencode') || lower.includes('opencode server')) {
    return 'No se pudo iniciar OpenCode. Comprueba la CLI (PATH) y proveedores.';
  }
  if (
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('fetch failed') ||
    lower.includes('network error') ||
    lower.includes('socket hang up')
  ) {
    return 'No se pudo conectar al servicio de sugerencias. Revisa red u OpenCode.';
  }
  if (
    /\b401\b/.test(lower) ||
    /\b403\b/.test(lower) ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return 'Acceso denegado o credenciales inválidas. Revisa la configuración del proveedor.';
  }
  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    /\b429\b/.test(lower)
  ) {
    return 'Demasiadas solicitudes; espera un momento o revisa límites en Settings.';
  }
  return null;
}

/**
 * Tras emitir UI al webview: aviso opcional para fallos accionables (con throttle).
 * @param {CompletionResult} result Resultado del intento de sugerencia que puede generar un hint.
 * @returns {void}
 */
export function maybeNotifySuggestionIssue(result: CompletionResult): void {
  if (!notificationsEnabled()) {
    return;
  }
  if (result.kind === 'empty') {
    const hint = hostHintForEmptyReason(result.reason);
    if (!hint) {
      return;
    }
    notify(hint, `empty:${result.reason}`);
    return;
  }
  if (result.kind === 'error') {
    const hint = hostHintForErrorMessage(result.message);
    if (!hint) {
      return;
    }
    notify(hint, `error:${hint}`);
  }
}
