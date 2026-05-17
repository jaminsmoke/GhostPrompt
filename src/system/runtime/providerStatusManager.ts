/**
 * @file Administrador de estado de proveedores LM (registry + refresh/start/stop).
 */
import { createProviderErrorRecord } from './createProviderErrorRecord';

import type { ProviderStateRecord, ProviderStatusModule } from '../internals/protocols/state/provider';

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
 * Registro central de módulos de estado de proveedores y notificaciones de cambio.
 */
export class ProviderStatusManager {
  private _modules = new Map<string, ProviderStatusModule>();
  private _onDidChange = new SimpleEventEmitter<ProviderStateRecord[]>();
  readonly onDidChange = this._onDidChange.on.bind(this._onDidChange);

  register(statusModule: ProviderStatusModule): void {
    this._modules.set(statusModule.id, statusModule);
  }

  getModule(id: string): ProviderStatusModule | undefined {
    return this._modules.get(id);
  }

  getAllModules(): ProviderStatusModule[] {
    return [...this._modules.values()];
  }

  async refreshAll(): Promise<ProviderStateRecord[]> {
    const results: ProviderStateRecord[] = [];
    for (const statusModule of this._modules.values()) {
      try {
        const state = await statusModule.check();
        results.push(state);
      } catch {
        results.push(createProviderErrorRecord(statusModule));
      }
    }
    this._onDidChange.fire(results);
    return results;
  }

  async refresh(id: string): Promise<ProviderStateRecord> {
    const statusModule = this._modules.get(id);
    if (!statusModule) {
      throw new Error(`Proveedor "${id}" no registrado`);
    }
    try {
      const state = await statusModule.check();
      this._onDidChange.fire([state]);
      return state;
    } catch {
      const errorState = createProviderErrorRecord(statusModule);
      this._onDidChange.fire([errorState]);
      return errorState;
    }
  }

  async start(id: string): Promise<ProviderStateRecord> {
    const statusModule = this._modules.get(id);
    if (!statusModule) {
      throw new Error(`Proveedor "${id}" no registrado`);
    }
    if (!statusModule.start) {
      throw new Error(`Proveedor "${id}" no soporta iniciar`);
    }
    await statusModule.start();
    return this.refresh(id);
  }

  async stop(id: string): Promise<ProviderStateRecord> {
    const statusModule = this._modules.get(id);
    if (!statusModule) {
      throw new Error(`Proveedor "${id}" no registrado`);
    }
    if (!statusModule.stop) {
      throw new Error(`Proveedor "${id}" no soporta detener`);
    }
    await statusModule.stop();
    return this.refresh(id);
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}

/** Singleton usado por la extensión y el webview. */
export const providerStatusManager = new ProviderStatusManager();
