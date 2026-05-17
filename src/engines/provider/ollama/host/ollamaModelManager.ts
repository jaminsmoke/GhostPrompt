/**
 * @file Gestor del ciclo de vida de modelos Ollama vía CLI.
 *
 * Proporciona verificación de instalación, listado de modelos locales,
 * inicio/detención de modelos con estados visibles.
 */
import { exec, spawn, type ChildProcess } from 'node:child_process';

type Listener<T> = (data: T) => void;

class SimpleEventEmitter<T> {
  private _listeners: Listener<T>[] = [];
  on(listener: Listener<T>): { dispose: () => void } {
    this._listeners.push(listener);
    return {
      dispose: () => {
        this._listeners = this._listeners.filter((l) => l !== listener);
      },
    };
  }
  fire(data: T): void {
    for (const l of this._listeners) {
      l(data);
    }
  }
  dispose(): void {
    this._listeners = [];
  }
}

export type OllamaManagerState =
  'checking' | 'error' | 'idle' | 'listing' | 'ready-model' | 'ready' | 'starting' | 'stopping';

class OllamaModelManager {
  private _state: OllamaManagerState = 'idle';
  private _currentModel: string | undefined = undefined;
  private _ollamaProcess: ChildProcess | undefined = undefined;
  private _onDidChangeState = new SimpleEventEmitter<{
    state: OllamaManagerState;
    model?: string;
    message?: string;
  }>();

  readonly onDidChangeState = this._onDidChangeState.on.bind(this._onDidChangeState);

  get state(): OllamaManagerState {
    return this._state;
  }

  get currentModel(): string | undefined {
    return this._currentModel;
  }

  private setState(state: OllamaManagerState, model?: string, message?: string): void {
    this._state = state;
    this._onDidChangeState.fire({ state, model, message });
  }

  private execAsync(cmd: string, timeoutMs = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(cmd, { timeout: timeoutMs }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr.trim() || err.message));
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  /**
   * Verifica que Ollama esté instalado ejecutando `ollama --version`.
   * Retorna la versión si ok, o lanza error si no está instalado.
   * @returns {Promise<string>} Versión de Ollama.
   */
  async checkInstallation(): Promise<string> {
    this.setState('checking');
    try {
      const version = await this.execAsync('ollama --version', 5000);
      this.setState('ready');
      return version;
    } catch {
      this.setState('error', undefined, 'Ollama no está instalado o no está en el PATH.');
      throw new Error('Ollama not installed');
    }
  }

  /**
   * Lista los modelos instalados vía `ollama list`.
   * Retorna array de nombres de modelo.
   * @returns {Promise<string[]>} Lista de modelos instalados.
   */
  async listInstalledModels(): Promise<string[]> {
    this.setState('listing');
    try {
      const stdout = await this.execAsync('ollama list', 10_000);
      const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        return [];
      }
      const models = lines
        .slice(1)
        .map((line) => {
          const parts = line.trim().split(/\s+/u);
          return parts[0];
        })
        .filter(Boolean);
      this.setState('ready');
      return models;
    } catch {
      this.setState('error', undefined, 'No se pudieron listar los modelos Ollama.');
      return [];
    }
  }

  /**
   * Inicia un modelo vía `ollama run &lt;modelId>` con flags:
   * - `--keepalive 5m`: mantiene el modelo cargado 5 minutos tras el último uso
   * - `--nowordwrap`: evita saltos de línea en el output.
   *
   * El proceso se lanza en background con `spawn`. La Promise resuelve cuando
   * stdout/stderr contiene "success", "loaded", "send a message" o "/bye",
   * indicando que el modelo está listo para recibir requests.
   * @param {string} modelId - Nombre del modelo (ej. "mistral:latest").
   * @param {globalThis.AbortSignal} [signal] - Señal de cancelación (opcional).
   * @throws {Error} Si el modelo no se inicia en 120s (timeout).
   * @throws {Error} Si stderr contiene "error" o "failed".
   * @returns {Promise<void>} Promise que se resuelve cuando el modelo ya está listo o falla.
   */
  startModel(modelId: string, signal?: AbortSignal): Promise<void> {
    if (this._ollamaProcess) {
      this._ollamaProcess.kill();
      this._ollamaProcess = undefined;
    }

    this._currentModel = modelId;
    this.setState('starting', modelId);

    return new Promise((resolve, reject) => {
      const proc = spawn('ollama', ['run', modelId, '--keepalive', '5m', '--nowordwrap'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this._ollamaProcess = proc;

      let resolved = false;
      const startTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (this._ollamaProcess && !this._ollamaProcess.killed) {
            this._ollamaProcess.kill();
          }
          this.setState('error', modelId, 'Tiempo de espera agotado al iniciar el modelo.');
          reject(new Error('Timeout starting model'));
        }
      }, 120_000);

      const checkOutput = (data: string) => {
        if (resolved) {
          return;
        }
        if (
          data.includes('success') ||
          data.includes('loaded') ||
          data.toLowerCase().includes('send a message') ||
          data.includes('/bye')
        ) {
          resolved = true;
          clearTimeout(startTimeout);
          this.setState('ready-model', modelId);
          resolve();
        }
      };

      proc.stdout.on('data', (data: Buffer) => checkOutput(data.toString()));

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        checkOutput(text);
        if (
          !resolved &&
          /error|failed|not found/iu.test(text) &&
          !text.includes('Failed to connect to socket')
        ) {
          resolved = true;
          clearTimeout(startTimeout);
          this._ollamaProcess = undefined;
          proc.kill();
          this.setState('error', modelId, text.trim());
          reject(new Error(text.trim()));
        }
      });

      proc.on('error', (err) => {
        if (resolved) {
          return;
        }
        resolved = true;
        clearTimeout(startTimeout);
        this._ollamaProcess = undefined;
        this.setState('error', modelId, err.message);
        reject(err);
      });

      proc.on('exit', (code) => {
        this._ollamaProcess = undefined;
        if (!resolved && code !== 0) {
          resolved = true;
          clearTimeout(startTimeout);
          this.setState('error', modelId, `Process exited with code ${code}`);
          reject(new Error(`ollama run exited with code ${code}`));
        }
      });

      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(startTimeout);
              proc.kill();
              this._ollamaProcess = undefined;
              reject(new Error('Cancelled'));
            }
          },
          { once: true },
        );
      }
    });
  }

  /**
   * Verifica si hay un modelo cargado actualmente vía `ollama ps`.
   * Retorna el nombre del modelo activo si hay alguno cargado.
   * @returns {Promise<string | undefined>} Nombre del modelo activo.
   */
  async ps(): Promise<string | undefined> {
    try {
      const stdout = await this.execAsync('ollama ps', 5000);
      const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        return undefined;
      }
      const name = lines[1].trim().split(/\s+/u)[0];
      return name || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Detiene un modelo específico o todos si no se especifica modelo.
   * @param {string | undefined} [modelId] - Opcional ID del modelo a detener.
   * @returns {Promise<void>} Promise que indica cuando la operación ha terminado.
   */
  async stopModel(modelId?: string): Promise<void> {
    this.setState('stopping', modelId ?? this._currentModel ?? undefined);
    try {
      const target = modelId ?? this._currentModel ?? '';
      await (target ? this.execAsync(`ollama stop ${target}`, 10_000) : this.execAsync('ollama stop', 10_000));
    } catch {
      // ollama stop puede fallar si el modelo no estaba corriendo — se ignora
    }

    if (this._ollamaProcess && !this._ollamaProcess.killed) {
      this._ollamaProcess.kill();
      this._ollamaProcess = undefined;
    }

    this._currentModel = undefined;
    this.setState('idle');
  }

  /**
   * Detiene todos los modelos y limpia recursos.
   * @returns {Promise<void>} Promise que indica cuando todos los modelos están detenidos.
   */
  async stopAll(): Promise<void> {
    await this.stopModel();
  }

  /**
   * Limpia recursos (para dispose).
   */
  dispose(): void {
    if (this._ollamaProcess && !this._ollamaProcess.killed) {
      this._ollamaProcess.kill();
      this._ollamaProcess = undefined;
    }
    this._onDidChangeState.dispose();
  }
}

export const ollamaModelManager = new OllamaModelManager();
