/**
 * @file Estado de proveedor OpenCode y verificación de salud.
 */
import * as vscode from 'vscode';

import type {
  CompletionSourceStateRecord,
  CompletionSourceStatusModule,
} from '../status/completionSourceStatusTypes';

const OPENCODE_DEFAULT_PORT = 4096;

/**
 * Verifica si el servidor OpenCode responde al endpoint health.
 * @param {string} baseUrl URL base de OpenCode.
 * @returns {Promise<boolean>} True si el servidor responde correctamente.
 */
async function pingOpenCode(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Obtiene la base URL de OpenCode desde la configuración.
 * @returns {string} URL de OpenCode para las comprobaciones de estado.
 */
function getOpenCodeBaseUrl(): string {
  const cfg = vscode.workspace.getConfiguration('ghostPrompt');
  return cfg.get<string>('opencodeBaseUrl', `http://127.0.0.1:${OPENCODE_DEFAULT_PORT}`);
}

export const opencodeStatusModule: CompletionSourceStatusModule = {
  id: 'opencode',
  label: 'OpenCode',

  /**
   * Comprueba el estado del servidor OpenCode.
   * @returns {Promise<CompletionSourceStateRecord>} Registro de estado de la fuente OpenCode.
   */
  async check(): Promise<CompletionSourceStateRecord> {
    const baseUrl = getOpenCodeBaseUrl();
    const alive = await pingOpenCode(baseUrl);

    if (alive) {
      return {
        id: 'opencode',
        status: 'running',
        label: 'OpenCode',
        statusText: 'Servidor activo',
        actions: ['stop'],
      };
    }

    return {
      id: 'opencode',
      status: 'stopped',
      label: 'OpenCode',
      statusText: 'Servidor detenido',
      actions: ['start'],
    };
  },

  /**
   * Inicia el servidor OpenCode en un terminal local.
   * @returns {Promise<void>} Promise que se resuelve cuando OpenCode se inicia satisfactoriamente.
   */
  async start(): Promise<void> {
    const baseUrl = getOpenCodeBaseUrl();
    const terminal = vscode.window.createTerminal('GhostPrompt OpenCode');
    terminal.sendText(
      `opencode --headless --port ${new URL(baseUrl).port || OPENCODE_DEFAULT_PORT}`,
    );
    terminal.show();
    // Esperar a que el servidor esté listo
    for (let i = 0; i < 30; i++) {
      const alive = await pingOpenCode(baseUrl);
      if (alive) {
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('No se pudo iniciar OpenCode (timeout 30s)');
  },

  /**
   * Detiene el servidor OpenCode usando su endpoint de salida o cerrando terminales.
   * @returns {Promise<void>} Promise que se resuelve cuando se detiene OpenCode.
   */
  async stop(): Promise<void> {
    const baseUrl = getOpenCodeBaseUrl();
    try {
      await fetch(`${baseUrl}/exit`, { method: 'POST', signal: AbortSignal.timeout(3000) });
    } catch {
      // Si no responde, forzar cierre de terminales de OpenCode
      vscode.window.terminals.forEach((t) => {
        if (t.name.includes('OpenCode')) {
          t.dispose();
        }
      });
    }
  },
};
