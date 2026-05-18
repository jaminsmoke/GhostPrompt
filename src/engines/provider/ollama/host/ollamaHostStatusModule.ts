/**
 * @file Host I/O Ollama: instalación CLI, modelos disponibles y sesión (`ollama ps`) como `ProviderStatusModule`.
 */
import { exec } from 'node:child_process';

import {
  OLLAMA_CLI_LONG_TIMEOUT_MS,
  OLLAMA_CLI_SHORT_TIMEOUT_MS,
} from '../ollamaTimeouts';

import { ollamaModelManager } from './ollamaModelManager';

import type { ProviderStateRecord, ProviderStatusModule } from '../../../../system/internals/protocols/state/provider';

/**
 * Ejecuta un comando de shell y devuelve su salida estándar.
 * @param {string} cmd - Comando a ejecutar.
 * @param {number} timeoutMs - Tiempo máximo en milisegundos para la ejecución.
 * @returns {Promise<string>} Salida estándar del comando.
 */
function execAsync(cmd: string, timeoutMs = OLLAMA_CLI_SHORT_TIMEOUT_MS): Promise<string> {
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
 * @param {string} stdout - Salida estándar del comando ollama.
 * @returns {string[]} Lista de nombres de modelo disponibles.
 */
function parseModelList(stdout: string): string[] {
  const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
  return lines
    .slice(1)
    .map((line) => line.trim().split(/\s+/u)[0])
    .filter(Boolean);
}

export const ollamaStatusModule: ProviderStatusModule = {
  id: 'ollama',
  label: 'Ollama',

  async check(): Promise<ProviderStateRecord> {
    let version: string;
    try {
      version = await execAsync('ollama --version', OLLAMA_CLI_SHORT_TIMEOUT_MS);
    } catch {
      return {
        id: 'ollama',
        status: 'unavailable',
        label: 'Ollama',
        statusText: 'No instalado',
      };
    }

    let models: string[];
    try {
      const stdout = await execAsync('ollama list', OLLAMA_CLI_LONG_TIMEOUT_MS);
      models = parseModelList(stdout);
    } catch {
      return {
        id: 'ollama',
        status: 'stopped',
        label: 'Ollama',
        statusText: `Instalado (${version})`,
      };
    }

    if (models.length === 0) {
      return {
        id: 'ollama',
        status: 'stopped',
        label: 'Ollama',
        statusText: 'Instalado — sin modelos',
      };
    }

    const activeModel = await ollamaModelManager.ps();
    if (activeModel) {
      return {
        id: 'ollama',
        status: 'running',
        label: 'Ollama',
        statusText: `${activeModel} activo`,
        actions: ['stop'],
      };
    }

    return {
      id: 'ollama',
      status: 'stopped',
      label: 'Ollama',
      statusText: `${models.length} modelo${models.length > 1 ? 's' : ''} disponible${models.length > 1 ? 's' : ''}`,
      actions: [],
    };
  },
};
