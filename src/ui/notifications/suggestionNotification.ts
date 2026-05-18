/**
 * @file Avisos no intrusivos en el host cuando fallan sugerencias accionables.
 *
 * Avisos no intrusivos en el host cuando fallan sugerencias por causas accionables.
 * La UI del webview sigue siendo la fuente principal; esto complementa sin sustituir el debug.
 */

import * as vscode from 'vscode';

import { isDefined } from '../../system/internals/isDefined';

import type { CompletionResult } from '../../system/internals/protocols/types';

/** Ventana mínima entre avisos repetidos del mismo motivo (ms). */
export const SUGGESTION_HOST_NOTIFICATION_THROTTLE_MS = 90_000;

const THROTTLE_MS = SUGGESTION_HOST_NOTIFICATION_THROTTLE_MS;
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
  return vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<boolean>('showSuggestionIssueNotifications', true);
}

/**
 * Determina si se puede mostrar una notificación con throttle.
 * @param {string} key - Clave de evento para evitar repetición rápida.
 * @returns {boolean} True si la notificación puede mostrarse.
 */
function shouldShow(key: string): boolean {
  const now = Date.now();
  const prev = lastShownAt.get(key);
  if (isDefined(prev) && now - prev < THROTTLE_MS) {
    return false;
  }
  lastShownAt.set(key, now);
  return true;
}

/**
 * Muestra un aviso en el host cuando procede y pasa el throttle.
 * @param {string} text - Texto de notificación mostrado al usuario.
 * @param {string} key - Clave de notificación para el throttle.
 * @returns {void}
 */
function notify(text: string, key: string): void {
  if (!shouldShow(key)) {
    return;
  }
  Promise.resolve(vscode.window.showWarningMessage(`GhostPrompt: ${text}`)).catch(() => {
    /* Ignore */
  });
}

type EmptyReason = Extract<CompletionResult, { kind: 'empty' }>['reason'];

/**
 * Obtiene un hint de UI para razones de resultado vacío.
 * @param {EmptyReason} reason - Motivo de resultado vacío.
 * @returns {string | undefined} Mensaje de ayuda si hay hint aplicable.
 */
function hostHintForEmptyReason(reason: EmptyReason): string | false {
  if (reason === 'no-model') {
    return 'No hay motor de sugerencias (Copilot u OpenCode). Revisa fuentes en configuración.';
  }
  if (reason === 'no-included-model') {
    return 'No hay modelo incluido disponible; revisa la política de modelo o el selector.';
  }
  if (reason === 'premium-quota-blocked') {
    return 'Cuota premium agotada: el modo solo incluido está pausando sugerencias.';
  }
  return false;
}

/**
 * Traduce mensajes de error técnicos a hints de usuario.
 * @param {string} message - Mensaje de error recibido de la sugerencia.
 * @returns {string | undefined} Texto de hint si se reconoce el error.
 */
function hostHintForErrorMessage(message: string): string | false {
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
    /\b401\b/u.test(lower) ||
    /\b403\b/u.test(lower) ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return 'Acceso denegado o credenciales inválidas. Revisa la configuración del proveedor.';
  }
  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    /\b429\b/u.test(lower)
  ) {
    return 'Demasiadas solicitudes; espera un momento o revisa límites en Settings.';
  }
  return false;
}

/**
 * Tras emitir UI al webview: aviso opcional para fallos accionables (con throttle).
 * @param {CompletionResult} result - Resultado del intento de sugerencia que puede generar un hint.
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
