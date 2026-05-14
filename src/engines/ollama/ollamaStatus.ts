import { exec } from "node:child_process";
import type { ProviderStatusModule, ProviderStateRecord } from "../../system/status/types";

function execAsync(cmd: string, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) { reject(new Error(stderr.trim() || err.message)); }
      else { resolve(stdout.trim()); }
    });
  });
}

export const ollamaStatusModule: ProviderStatusModule = {
  id: "ollama",
  kind: "engine",
  label: "Ollama",

  async check(): Promise<ProviderStateRecord> {
    // 1. Verificar instalación
    let version: string;
    try {
      version = await execAsync("ollama --version", 5000);
    } catch {
      return {
        id: "ollama",
        kind: "engine",
        status: "unavailable",
        label: "Ollama",
        statusText: "No instalado",
      };
    }

    // 2. Listar modelos
    try {
      const stdout = await execAsync("ollama list", 10000);
      const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
      const modelCount = Math.max(0, lines.length - 1);

      if (modelCount > 0) {
        return {
          id: "ollama",
          kind: "engine",
          status: "running",
          label: "Ollama",
          statusText: `${modelCount} modelo${modelCount !== 1 ? "s" : ""} instalado${modelCount !== 1 ? "s" : ""}`,
          actions: ["stop"],
        };
      }

      return {
        id: "ollama",
        kind: "engine",
        status: "stopped",
        label: "Ollama",
        statusText: `Instalado (${version}) — sin modelos`,
        actions: [],
      };
    } catch {
      return {
        id: "ollama",
        kind: "engine",
        status: "stopped",
        label: "Ollama",
        statusText: `Instalado (${version})`,
        actions: [],
      };
    }
  },
};
