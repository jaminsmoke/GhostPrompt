/**
 * @file Administrador de estado de fuentes de completado del motor de sugerencias.
 */
import { createCompletionSourceErrorRecord } from './createCompletionSourceErrorRecord';

import type {
  CompletionSourceStateRecord,
  CompletionSourceStatusModule,
} from './completionSourceStatusTypes';

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
    for (const listener of this._listeners) {
      listener(data);
    }
  }

  dispose(): void {
    this._listeners = [];
  }
}

/**
 * Registro central de módulos de estado de fuentes de completado y notificaciones de cambio.
 */
export class CompletionSourceStatusManager {
  private _modules = new Map<string, CompletionSourceStatusModule>();
  private _onDidChange = new SimpleEventEmitter<CompletionSourceStateRecord[]>();
  readonly onDidChange = this._onDidChange.on.bind(this._onDidChange);

  /**
   * Registra un módulo de estado de fuente de completado.
   * @param {CompletionSourceStatusModule} mod Módulo que implementa check/start/stop.
   */
  register(mod: CompletionSourceStatusModule): void {
    this._modules.set(mod.id, mod);
  }

  /**
   * Obtiene un módulo registrado por id.
   * @param {string} id Identificador de la fuente, por ejemplo `copilot` u `ollama`.
   * @returns {CompletionSourceStatusModule | undefined} Módulo registrado o undefined.
   */
  getModule(id: string): CompletionSourceStatusModule | undefined {
    return this._modules.get(id);
  }

  /**
   * Devuelve todos los módulos registrados.
   * @returns {CompletionSourceStatusModule[]} Lista de módulos en orden de registro.
   */
  getAllModules(): CompletionSourceStatusModule[] {
    return Array.from(this._modules.values());
  }

  /**
   * Ejecuta `check()` en todos los módulos y emite el resultado agregado.
   * @returns {Promise<CompletionSourceStateRecord[]>} Estados actuales de cada fuente.
   */
  async refreshAll(): Promise<CompletionSourceStateRecord[]> {
    const results: CompletionSourceStateRecord[] = [];
    for (const mod of this._modules.values()) {
      try {
        const state = await mod.check();
        results.push(state);
      } catch {
        results.push(createCompletionSourceErrorRecord(mod));
      }
    }
    this._onDidChange.fire(results);
    return results;
  }

  /**
   * Ejecuta `check()` en un módulo concreto.
   * @param {string} id Identificador de la fuente a refrescar.
   * @returns {Promise<CompletionSourceStateRecord>} Estado actual de la fuente.
   * @throws {Error} Si el id no está registrado.
   */
  async refresh(id: string): Promise<CompletionSourceStateRecord> {
    const mod = this._modules.get(id);
    if (!mod) {
      throw new Error(`Fuente de completado "${id}" no registrada`);
    }
    try {
      const state = await mod.check();
      this._onDidChange.fire([state]);
      return state;
    } catch {
      const errorState = createCompletionSourceErrorRecord(mod);
      this._onDidChange.fire([errorState]);
      return errorState;
    }
  }

  /**
   * Inicia una fuente que expone `start` y refresca su estado.
   * @param {string} id Identificador de la fuente.
   * @returns {Promise<CompletionSourceStateRecord>} Estado tras iniciar y refrescar.
   * @throws {Error} Si el id no existe o la fuente no soporta start.
   */
  async start(id: string): Promise<CompletionSourceStateRecord> {
    const mod = this._modules.get(id);
    if (!mod) {
      throw new Error(`Fuente de completado "${id}" no registrada`);
    }
    if (!mod.start) {
      throw new Error(`Fuente de completado "${id}" no soporta iniciar`);
    }
    await mod.start();
    return this.refresh(id);
  }

  /**
   * Detiene una fuente que expone `stop` y refresca su estado.
   * @param {string} id Identificador de la fuente.
   * @returns {Promise<CompletionSourceStateRecord>} Estado tras detener y refrescar.
   * @throws {Error} Si el id no existe o la fuente no soporta stop.
   */
  async stop(id: string): Promise<CompletionSourceStateRecord> {
    const mod = this._modules.get(id);
    if (!mod) {
      throw new Error(`Fuente de completado "${id}" no registrada`);
    }
    if (!mod.stop) {
      throw new Error(`Fuente de completado "${id}" no soporta detener`);
    }
    await mod.stop();
    return this.refresh(id);
  }

  /**
   * Libera listeners internos del manager.
   */
  dispose(): void {
    this._onDidChange.dispose();
  }
}

/** Singleton usado por la extensión y el webview. */
export const completionSourceStatusManager = new CompletionSourceStatusManager();
