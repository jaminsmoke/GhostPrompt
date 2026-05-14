import type { ProviderStatusModule, ProviderStateRecord } from './types';

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

export class ProviderStatusManager {
  private _modules = new Map<string, ProviderStatusModule>();
  private _onDidChange = new SimpleEventEmitter<ProviderStateRecord[]>();
  readonly onDidChange = this._onDidChange.on.bind(this._onDidChange);

  register(mod: ProviderStatusModule): void {
    this._modules.set(mod.id, mod);
  }

  getModule(id: string): ProviderStatusModule | undefined {
    return this._modules.get(id);
  }

  getAllModules(): ProviderStatusModule[] {
    return Array.from(this._modules.values());
  }

  async refreshAll(): Promise<ProviderStateRecord[]> {
    const results: ProviderStateRecord[] = [];
    for (const mod of this._modules.values()) {
      try {
        const state = await mod.check();
        results.push(state);
      } catch {
        results.push({
          id: mod.id,
          kind: mod.kind,
          status: 'error',
          label: mod.label,
          statusText: 'Error al comprobar estado',
        });
      }
    }
    this._onDidChange.fire(results);
    return results;
  }

  async refresh(id: string): Promise<ProviderStateRecord> {
    const mod = this._modules.get(id);
    if (!mod) {
      throw new Error(`Provider "${id}" no registrado`);
    }
    try {
      const state = await mod.check();
      this._onDidChange.fire([state]);
      return state;
    } catch {
      const errorState: ProviderStateRecord = {
        id: mod.id,
        kind: mod.kind,
        status: 'error',
        label: mod.label,
        statusText: 'Error al comprobar estado',
      };
      this._onDidChange.fire([errorState]);
      return errorState;
    }
  }

  async start(id: string): Promise<ProviderStateRecord> {
    const mod = this._modules.get(id);
    if (!mod) {
      throw new Error(`Provider "${id}" no registrado`);
    }
    if (!mod.start) {
      throw new Error(`Provider "${id}" no soporta iniciar`);
    }
    await mod.start();
    return this.refresh(id);
  }

  async stop(id: string): Promise<ProviderStateRecord> {
    const mod = this._modules.get(id);
    if (!mod) {
      throw new Error(`Provider "${id}" no registrado`);
    }
    if (!mod.stop) {
      throw new Error(`Provider "${id}" no soporta detener`);
    }
    await mod.stop();
    return this.refresh(id);
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}

export const providerStatusManager = new ProviderStatusManager();
