/**
 * Escapa texto para insertarlo en HTML del ghost inline (no usar para atributos sin comillas extra).
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
