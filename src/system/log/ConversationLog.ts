/**
 * @file Log persistente de prompts enviados al chat de Copilot.
 *
 * Cada prompt se añade a `conversation.md` en el almacenamiento privado de
 * la extensión (`context.storageUri`), invisible para el usuario.
 * Preparado para exponerse mediante un menú en v0.2.
 */
import * as vscode from 'vscode';

/**
 * Appends a timestamped prompt entry to the conversation log.
 * Creates the file if it does not exist yet.
 *
 * @param storageUri - URI de almacenamiento privado (`context.storageUri`).
 * @param prompt - The prompt text to record.
 */
export async function append(storageUri: vscode.Uri, prompt: string): Promise<void> {
  const logUri = vscode.Uri.joinPath(storageUri, 'conversation.md');
  const timestamp = new Date().toISOString();
  const entry = `\n## ${timestamp}\n\n${prompt}\n`;

  let existing = '';
  try {
    const bytes = await vscode.workspace.fs.readFile(logUri);
    existing = Buffer.from(bytes).toString('utf-8');
  } catch {
    // El archivo no existe aún — se crea en el primer registro.
  }

  const updated = existing + entry;
  // Asegurar que el directorio de almacenamiento existe antes de escribir.
  await vscode.workspace.fs.createDirectory(storageUri);
  await vscode.workspace.fs.writeFile(logUri, Buffer.from(updated, 'utf-8'));
}
