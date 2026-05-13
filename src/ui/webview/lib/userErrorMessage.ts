/**
 * Mensajes de estado vacío y errores del host normalizados para la UI del webview.
 */

export interface EmptySuggestionContext {
  completionUiKind: string;
  completionProvider: string;
}

export function messageForEmptySuggestion(
  reason: string,
  ctx: EmptySuggestionContext,
): string {
  switch (reason) {
    case "no-model":
      if (ctx.completionUiKind === "multi") {
        return "No hay modelos disponibles (Copilot u OpenCode). Revisa fuentes habilitadas y OpenCode.";
      }
      return ctx.completionProvider === "opencode"
        ? "OpenCode no disponible o sin modelos."
        : "Copilot no disponible en esta sesión.";
    case "no-included-model":
      return "No hay modelo incluido disponible para suggestions.";
    case "premium-quota-blocked":
      return "Suggestions pausadas para evitar consumo de cuota premium.";
    case "empty-response":
      return "El modelo respondió vacío. Prueba otro modelo o reformula el texto.";
    case "too-short":
      return "Escribe un poco más para sugerir mejor.";
    case "duplicate-input":
      return "Esperando cambios en el texto...";
    case "rate-limited":
      return "Pausado temporalmente por limite de llamadas. Puedes ampliar el limite en Settings.";
    case "session-budget-exhausted":
      return "Se alcanzo el limite de suggestions de esta sesion. Ajustalo en Settings si necesitas mas.";
    case "request-timeout":
      return "El modelo tardo demasiado en responder. Prueba otro modelo o vuelve a intentarlo.";
    default:
      return "Sin sugerencia para este texto.";
  }
}

const ERROR_BODY_MAX_LEN = 140;

function formatErrorBody(body: string): string {
  const compact = body.replace(/\s+/g, " ");
  if (compact.length <= ERROR_BODY_MAX_LEN) {
    return compact;
  }
  return `${compact.slice(0, ERROR_BODY_MAX_LEN - 3)}...`;
}

function mapKnownErrorToUserHint(normalized: string): string | null {
  const lower = normalized.toLowerCase();

  if (
    lower.includes("premium model quota") ||
    lower.includes("additional paid premium") ||
    lower.includes("allowance to renew")
  ) {
    return "Cuota de modelo premium agotada o limitada. Elige un modelo incluido o revisa tu plan de Copilot.";
  }

  if (
    lower.includes("failed to start opencode") ||
    lower.includes("opencode server")
  ) {
    return "No se pudo iniciar OpenCode. Comprueba que la CLI esté instalada (PATH) y la configuración de proveedores.";
  }

  if (
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("fetch failed") ||
    lower.includes("network error") ||
    lower.includes("socket hang up")
  ) {
    return "No se pudo conectar. Revisa la red o que el servicio OpenCode esté disponible.";
  }

  if (
    /\b401\b/.test(lower) ||
    /\b403\b/.test(lower) ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden")
  ) {
    return "Acceso denegado o credenciales inválidas. Revisa la configuración del proveedor.";
  }

  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    /\b429\b/.test(lower)
  ) {
    return "Demasiadas solicitudes en poco tiempo. Espera un momento o revisa límites en Settings.";
  }

  return null;
}

export function toUserErrorMessage(rawMessage: unknown): string {
  if (!rawMessage) {
    return "Error al generar sugerencia.";
  }
  const normalized = String(rawMessage).trim();
  const compact = normalized.replace(/\s+/g, " ");
  const hint = mapKnownErrorToUserHint(compact);
  const body = hint ?? compact;
  return `Error: ${formatErrorBody(body)}`;
}
