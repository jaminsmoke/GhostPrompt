import * as vscode from "vscode";
import type { ProviderStatusModule, ProviderStateRecord } from "./types";

export class ProviderStatusManager {
  private _modules = new Map<string, ProviderStatusModule>();
  private _onDidChange = new vscode.EventEmitter<ProviderStateRecord[]>();
  readonly onDidChange = this._onDidChange.event;

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
          status: "error",
          label: mod.label,
          statusText: "Error al comprobar estado",
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
        status: "error",
        label: mod.label,
        statusText: "Error al comprobar estado",
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
