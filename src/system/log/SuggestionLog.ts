/**
 * @file Log persistente de suggestions de Copilot que el usuario
 * aceptó explícitamente con Tab en el Prompt Assistant.
 *
 * Cada entrada se añade a `suggestions.md` en el almacenamiento privado de
 * la extensión (`context.storageUri`), invisible para el usuario.
 */
import * as vscode from "vscode";

/**
 * Registra en `suggestions.md` una suggestion que el usuario aceptó.
 *
 * @param storageUri - URI de almacenamiento privado (`context.storageUri`).
 * @param context - El texto que el usuario había escrito cuando se generó la suggestion.
 * @param suggestion - El texto de la suggestion aceptada.
 */
export async function appendSuggestion(
  storageUri: vscode.Uri,
  context: string,
  suggestion: string,
): Promise<void> {
  const logUri = vscode.Uri.joinPath(storageUri, "suggestions.md");
  const timestamp = new Date().toISOString();
  const entry = `\n## ${timestamp}\n\n**Contexto:** ${context}\n\n**Suggestion aceptada:** ${suggestion}\n`;

  let existing = "";
  try {
    const bytes = await vscode.workspace.fs.readFile(logUri);
    existing = Buffer.from(bytes).toString("utf-8");
  } catch {
    // El archivo no existe aún — se crea en el primer registro.
  }

  const updated = existing + entry;
  // Asegurar que el directorio de almacenamiento existe antes de escribir.
  await vscode.workspace.fs.createDirectory(storageUri);
  await vscode.workspace.fs.writeFile(logUri, Buffer.from(updated, "utf-8"));
}
