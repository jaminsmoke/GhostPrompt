export type ProviderKind = "engine" | "destination";

export type ProviderState = "running" | "stopped" | "starting" | "unavailable" | "error";

export interface ProviderStateRecord {
  id: string;
  kind: ProviderKind;
  status: ProviderState;
  label: string;
  statusText?: string;
  actions?: ("start" | "stop")[];
}

export interface ProviderStatusModule {
  id: string;
  kind: ProviderKind;
  label: string;
  check(): Promise<ProviderStateRecord>;
  start?(): Promise<void>;
  stop?(): Promise<void>;
}
