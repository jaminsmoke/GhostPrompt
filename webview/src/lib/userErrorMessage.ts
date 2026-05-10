/**
 * Normaliza mensajes de error del host para la UI del webview.
 */
export function toUserErrorMessage(rawMessage: unknown): string {
  if (!rawMessage) {
    return "Error al generar sugerencia.";
  }
  const normalized = String(rawMessage).trim();
  const compact = normalized.replace(/\s+/g, " ");
  const maxLen = 140;
  if (compact.length <= maxLen) {
    return `Error: ${compact}`;
  }
  return `Error: ${compact.slice(0, maxLen - 3)}...`;
}
