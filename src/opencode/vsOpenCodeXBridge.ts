/**
 * Reutiliza el servidor OpenCode gestionado por VSOpenCodeX cuando está disponible.
 * @see Docs/Integrations/GhostPrompt-OpenCode-coexistence.md
 */
import * as vscode from "vscode";

import { logOpenCodeDebug } from "../debug/SuggestionDebug";
import { ensureNodeFetchDuplex } from "./nodeFetchDuplex";

/** Ajustar sólo en tests internos si hiciera falta. */
export const VS_OPEN_CODE_X_EXTENSION_ID = "jaminsmoke.vsopencodex";

export const COMMAND_GET_OPENCODE_CONNECTION = "vsopencodex.getOpenCodeConnection";

export type VsOpenCodeXConnectionEnvelope =
  | { ok: true; baseUrl: string; authorizationHeader: string; port: number }
  | { ok: false; reason: string };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Intenta obtener un cliente SDK apuntando al servidor VSOpenCodeX.
 * Sin extensión, comando ausente o `ok: false`, devuelve `undefined` (fallback embebido).
 */
export async function tryCreateSdkClientViaVsOpenCodeX(params: {
  probeDelayMs: number;
}): Promise<{ client: unknown; baseUrl: string } | undefined> {
  const extension = vscode.extensions.getExtension(VS_OPEN_CODE_X_EXTENSION_ID);
  if (!extension) {
    return undefined;
  }
  try {
    if (!extension.isActive) {
      await extension.activate();
    }
  } catch {
    logOpenCodeDebug("vsopencodex-activate-failed");
    return undefined;
  }

  const probe = Math.max(0, params.probeDelayMs);
  if (probe > 0) {
    await sleep(probe);
  }

  let envelope: VsOpenCodeXConnectionEnvelope | undefined;
  try {
    envelope =
      await vscode.commands.executeCommand<VsOpenCodeXConnectionEnvelope>(
        COMMAND_GET_OPENCODE_CONNECTION,
      );
  } catch {
    logOpenCodeDebug("vsopencodex-get-connection-command-failed");
    return undefined;
  }

  if (!envelope || !envelope.ok) {
    if (envelope && !envelope.ok) {
      logOpenCodeDebug("vsopencodex-connection-not-ready", envelope.reason);
    }
    return undefined;
  }

  try {
    ensureNodeFetchDuplex();
    const { createOpencodeClient } = await import("@opencode-ai/sdk");
    const authHeaders: Record<string, string> = {};
    authHeaders.Authorization = envelope.authorizationHeader;
    const client = createOpencodeClient({
      baseUrl: envelope.baseUrl,
      headers: authHeaders,
    });
    logOpenCodeDebug("vsopencodex-client-attached", `baseUrl=${envelope.baseUrl}`);
    return { client, baseUrl: envelope.baseUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logOpenCodeDebug("vsopencodex-client-create-failed", msg);
    return undefined;
  }
}
