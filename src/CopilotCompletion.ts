/**
 * @fileoverview Solicita completions al modelo de lenguaje de Copilot
 * usando la API `vscode.lm` — sin abrir ningún editor ni robar el foco.
 *
 * Sustituye al ciclo draft.md + inlineSuggest que era la causa de:
 *   - draft.md visible como pestaña del editor.
 *   - Pérdida de foco del webview al abrir el documento de borrador.
 */
import * as vscode from "vscode";

/**
 * Solicita al modelo Copilot una continuación corta del texto parcial del usuario.
 *
 * @param userText - Texto que el usuario está escribiendo en el mini-input.
 * @returns La continuación sugerida, o cadena vacía si no hay modelo disponible.
 */
export async function requestCompletion(userText: string): Promise<string> {
  const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
  if (!models.length) {
    return "";
  }

  const model = models[0];
  const tokenSource = new vscode.CancellationTokenSource();

  try {
    const instruction =
      "You are a prompt completion assistant. " +
      "The user is typing a prompt for GitHub Copilot Chat. " +
      "Predict and return ONLY the natural continuation of the following partial text. " +
      "Never repeat what was already written. " +
      "Return at most one short sentence. " +
      "Do not add explanations, greetings, or any metadata.\n\n" +
      "Partial text to continue: " +
      userText;

    const response = await model.sendRequest(
      [vscode.LanguageModelChatMessage.User(instruction)],
      {},
      tokenSource.token,
    );

    let completion = "";
    for await (const chunk of response.text) {
      completion += chunk;
    }
    return completion.trim();
  } catch {
    return "";
  } finally {
    tokenSource.dispose();
  }
}
