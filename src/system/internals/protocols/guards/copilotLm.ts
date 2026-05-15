/**
 * @file Heurísticas puras sobre respuestas y errores del LM Copilot (sin estado).
 */

/**
 * Indica si el mensaje de error encaja con bloqueo de cuota premium de Copilot LM.
 * @param {string} message Texto del error devuelto por la API.
 * @returns {boolean} `true` si el mensaje sugiere cuota premium agotada.
 */
export function isPremiumQuotaCopilotError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('premium model quota') ||
    normalized.includes('additional paid premium requests') ||
    normalized.includes('allowance to renew')
  );
}

/**
 * Indica si el texto de respuesta parece una negativa de asistencia típica de Copilot.
 * @param {string} text Texto acumulado de la respuesta del modelo.
 * @returns {boolean} `true` si se interpreta como rechazo de contenido.
 */
export function looksLikeCopilotRefusal(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith("i'm sorry") || normalized.startsWith('im sorry')) {
    return /assist|help|provide|cannot|can't|unable/.test(normalized);
  }
  return (
    normalized.includes("can't assist") ||
    normalized.includes('cannot assist') ||
    normalized.includes('unable to assist') ||
    normalized.includes("can't help") ||
    normalized.includes('cannot help') ||
    normalized.includes('unable to help') ||
    normalized.includes('unable to provide') ||
    normalized.includes('cannot provide')
  );
}
