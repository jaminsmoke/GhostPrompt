/**
 * Etiquetas cortas para el resumen de opciones de composición (toolbar).
 * Extraído desde el cliente webview (roadmap v0.3.2 fase B).
 */

export function composeStyleShort(v: string): string {
  if (v === "concise") {
    return "Breve";
  }
  if (v === "detailed") {
    return "Extenso";
  }
  return "Normal";
}

export function composeContextShort(v: string): string {
  if (v === "project") {
    return "Proyecto";
  }
  if (v === "off") {
    return "Off";
  }
  return "Básico";
}

export function composeLangShort(
  choice: string,
  effective: string,
): string {
  if (choice === "auto") {
    const code =
      effective === "es" ? "ES" : effective === "en" ? "EN" : "...";
    return `Auto (${code})`;
  }
  return choice === "es" ? "ES" : "EN";
}
