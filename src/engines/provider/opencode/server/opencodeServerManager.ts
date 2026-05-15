/**
 * @file Ciclo de vida del servidor OpenCode (health, start, stop, configuración).
 */
import * as vscode from 'vscode';

import {
  OPENCODE_DEFAULT_PORT,
  type OpenCodeClientOptions,
} from '../../../../system/internals/protocols/types/opencodeClient';

export interface OpenCodeConnectionConfig {
  baseUrl: string;
  hostname: string;
  port: number;
  authToken?: string;
}

/**
 * Lee la configuración de conexión OpenCode desde VS Code (única fuente de verdad).
 * @returns {OpenCodeConnectionConfig} URL base, host, puerto y token opcional.
 */
export function getOpenCodeConnectionConfig(): OpenCodeConnectionConfig {
  const cfg = vscode.workspace.getConfiguration('ghostPrompt');
  const authToken = cfg.get<string>('opencodeAuthToken') ?? undefined;
  const portOverride = cfg.get<number>('opencodePort');
  const baseUrlSetting = cfg.get<string>('opencodeBaseUrl');

  if (baseUrlSetting?.trim()) {
    try {
      const url = new URL(baseUrlSetting.trim());
      const port = portOverride ?? (url.port ? Number(url.port) : OPENCODE_DEFAULT_PORT);
      return {
        baseUrl: baseUrlSetting.trim().replace(/\/$/, ''),
        hostname: url.hostname || '127.0.0.1',
        port,
        authToken,
      };
    } catch {
      // fallback below
    }
  }

  const port = portOverride ?? OPENCODE_DEFAULT_PORT;
  const hostname = '127.0.0.1';
  return {
    baseUrl: `http://${hostname}:${port}`,
    hostname,
    port,
    authToken,
  };
}

/**
 * Opciones para `createOpenCodeClient` derivadas de la configuración del workspace.
 * @returns {OpenCodeClientOptions} Host, puerto y token para el SDK.
 */
export function getOpenCodeClientOptions(): OpenCodeClientOptions {
  const { hostname, port, authToken } = getOpenCodeConnectionConfig();
  return { hostname, port, authToken };
}

/**
 * Comprueba si el servidor OpenCode responde en `/health`.
 * @param {string} [baseUrl] URL base; por defecto la de configuración.
 * @returns {Promise<boolean>} True si el servidor responde correctamente.
 */
export async function pingOpenCodeServer(baseUrl?: string): Promise<boolean> {
  const url = baseUrl ?? getOpenCodeConnectionConfig().baseUrl;
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Inicia OpenCode en un terminal local y espera hasta que responda health.
 */
export async function startOpenCodeServer(): Promise<void> {
  const { baseUrl, port } = getOpenCodeConnectionConfig();
  const terminal = vscode.window.createTerminal('GhostPrompt OpenCode');
  terminal.sendText(`opencode --headless --port ${port}`);
  terminal.show();

  for (let i = 0; i < 30; i++) {
    if (await pingOpenCodeServer(baseUrl)) {
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('No se pudo iniciar OpenCode (timeout 30s)');
}

/**
 * Detiene el servidor OpenCode vía `/exit` o cerrando terminales asociadas.
 */
export async function stopOpenCodeServer(): Promise<void> {
  const baseUrl = getOpenCodeConnectionConfig().baseUrl;
  try {
    await fetch(`${baseUrl}/exit`, { method: 'POST', signal: AbortSignal.timeout(3000) });
  } catch {
    vscode.window.terminals.forEach((t) => {
      if (t.name.includes('OpenCode')) {
        t.dispose();
      }
    });
  }
}
