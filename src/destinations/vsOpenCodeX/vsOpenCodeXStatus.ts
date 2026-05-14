import * as vscode from "vscode";
import type { ProviderStatusModule, ProviderStateRecord } from "../../system/status/types";

function isVsOpenCodeXExtensionInstalled(): boolean {
  return vscode.extensions.getExtension("jaminsmoke.vsopencodex") !== undefined;
}

export const vsOpenCodeXStatusModule: ProviderStatusModule = {
  id: "vsOpenCodeX",
  kind: "destination",
  label: "VSOpenCodeX",

  async check(): Promise<ProviderStateRecord> {
    if (isVsOpenCodeXExtensionInstalled()) {
      return {
        id: "vsOpenCodeX",
        kind: "destination",
        status: "running",
        label: "VSOpenCodeX",
        statusText: "Extensión instalada",
      };
    }

    return {
      id: "vsOpenCodeX",
      kind: "destination",
      status: "unavailable",
      label: "VSOpenCodeX",
      statusText: "Extensión no instalada",
    };
  },
};
