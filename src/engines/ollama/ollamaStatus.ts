import { exec } from 'node:child_process';
import type { ProviderStatusModule, ProviderStateRecord } from '../../system/internals/states/provider-types';
import { ollamaModelManager } from './ollamaModelManager';

/**
 * Ejecuta un comando de shell y devuelve su salida estándar.
 * @param {string} cmd Comando a ejecutar.
 * @param {number} timeoutMs Tiempo máximo en milisegundos para la ejecución.
 * @returns {Promise<string>} Salida estándar del comando.
 */
function execAsync(cmd: string, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr.trim() || err.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Parsea el resultado de `ollama list` en nombres de modelo.
 * @param {string} stdout Salida estándar del comando ollama.
 * @returns {string[]} Lista de nombres de modelo disponibles.
 */
function parseModelList(stdout: string): string[] {
  const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
  return lines
    .slice(1)
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean);
}

export const ollamaStatusModule: ProviderStatusModule = {
  id: 'ollama',
  kind: 'engine',
  label: 'Ollama',

  async check(): Promise<ProviderStateRecord> {
    let version: string;
    try {
      version = await execAsync('ollama --version', 5000);
    } catch {
      return {
        id: 'ollama',
        kind: 'engine',
        status: 'unavailable',
        label: 'Ollama',
        statusText: 'No instalado',
      };
    }

    let models: string[] = [];
    try {
      const stdout = await execAsync('ollama list', 10000);
      models = parseModelList(stdout);
    } catch {
      return {
        id: 'ollama',
        kind: 'engine',
        status: 'stopped',
        label: 'Ollama',
        statusText: `Instalado (${version})`,
      };
    }

    if (models.length === 0) {
      return {
        id: 'ollama',
        kind: 'engine',
        status: 'stopped',
        label: 'Ollama',
        statusText: 'Instalado — sin modelos',
      };
    }

    const activeModel = await ollamaModelManager.ps();
    if (activeModel) {
      return {
        id: 'ollama',
        kind: 'engine',
        status: 'running',
        label: 'Ollama',
        statusText: `${activeModel} activo`,
        actions: ['stop'],
      };
    }

    return {
      id: 'ollama',
      kind: 'engine',
      status: 'stopped',
      label: 'Ollama',
      statusText: `${models.length} modelo${models.length > 1 ? 's' : ''} disponible${models.length > 1 ? 's' : ''}`,
      actions: [],
    };
  },
};
