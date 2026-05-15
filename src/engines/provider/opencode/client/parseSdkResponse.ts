/**
 * @file Adaptadores de respuestas `unknown` del SDK OpenCode.
 */

/**
 * Extrae el ID de sesión del resultado de la API OpenCode.
 * @param {unknown} result Resultado bruto devuelto por la API.
 * @returns {string} ID de sesión o cadena vacía si no se encuentra.
 */
export function extractSessionId(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return '';
  }
  const r = result as { data?: { id?: string } };
  return r.data?.id ?? '';
}

/**
 * Extrae el texto generado del resultado de prompt OpenCode.
 * @param {unknown} result Resultado bruto de la API.
 * @returns {string} Texto concatenado del prompt.
 */
export function extractPromptText(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return '';
  }
  const r = result as { data?: { parts?: Array<{ type?: string; text?: string }> } };
  const parts = r.data?.parts ?? [];
  let text = '';
  for (const p of parts) {
    if (p.type === 'text' && typeof p.text === 'string') {
      text += p.text;
    }
  }
  return text;
}

/**
 * Extrae texto delta de un evento de stream OpenCode.
 * @param {unknown} data Evento bruto de stream.
 * @returns {string | undefined} Texto delta o undefined si no hay texto.
 */
export function extractDeltaText(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const d = data as Record<string, unknown>;
  if (d.type !== 'message') {
    return undefined;
  }
  const part = d.part as Record<string, unknown> | undefined;
  if (!part) {
    return undefined;
  }
  if (part.field !== 'text' || typeof part.delta !== 'string') {
    return undefined;
  }
  return part.delta;
}
