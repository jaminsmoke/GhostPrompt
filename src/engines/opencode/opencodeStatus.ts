import * as vscode from "vscode";
import type { ProviderStatusModule, ProviderStateRecord } from "../../system/status/types";

const OPENCODE_DEFAULT_PORT = 4096;

async function pingOpenCode(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function getOpenCodeBaseUrl(): Promise<string> {
  const cfg = vscode.workspace.getConfiguration("ghostPrompt");
  return cfg.get<string>("opencodeBaseUrl", `http://127.0.0.1:${OPENCODE_DEFAULT_PORT}`);
}

export const opencodeStatusModule: ProviderStatusModule = {
  id: "opencode",
  kind: "engine",
  label: "OpenCode",

  async check(): Promise<ProviderStateRecord> {
    const baseUrl = await getOpenCodeBaseUrl();
    const alive = await pingOpenCode(baseUrl);

    if (alive) {
      return {
        id: "opencode",
        kind: "engine",
        status: "running",
        label: "OpenCode",
        statusText: "Servidor activo",
        actions: ["stop"],
      };
    }

    return {
      id: "opencode",
      kind: "engine",
      status: "stopped",
      label: "OpenCode",
      statusText: "Servidor detenido",
      actions: ["start"],
    };
  },

  async start(): Promise<void> {
    const baseUrl = await getOpenCodeBaseUrl();
    const terminal = vscode.window.createTerminal("GhostPrompt OpenCode");
    terminal.sendText(`opencode --headless --port ${new URL(baseUrl).port || OPENCODE_DEFAULT_PORT}`);
    terminal.show();
    // Esperar a que el servidor esté listo
    for (let i = 0; i < 30; i++) {
      const alive = await pingOpenCode(baseUrl);
      if (alive) { return; }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("No se pudo iniciar OpenCode (timeout 30s)");
  },

  async stop(): Promise<void> {
    const baseUrl = await getOpenCodeBaseUrl();
    try {
      await fetch(`${baseUrl}/exit`, { method: "POST", signal: AbortSignal.timeout(3000) });
    } catch {
      // Si no responde, forzar cierre de terminales de OpenCode
      vscode.window.terminals.forEach((t) => {
        if (t.name.includes("OpenCode")) { t.dispose(); }
      });
    }
  },
};
