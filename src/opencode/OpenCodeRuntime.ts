import * as vscode from "vscode";

import { logOpenCodeDebug } from "../debug/SuggestionDebug";
import { checkOpenCodeCli } from "./openCodeCli";
import {
  GHOST_PROMPT_OPENCODE_PORT,
  OPENCODE_STOP_DEBOUNCE_MS,
} from "./constants";
import { ensureNodeFetchDuplex } from "./nodeFetchDuplex";
import { emitOpenCodeServerWillReset } from "./openCodeServerLifecycleHooks";
import {
  tryCreateSdkClientViaVsOpenCodeX,
  VS_OPEN_CODE_X_EXTENSION_ID,
} from "./vsOpenCodeXBridge";

export type OpenCodeStartOk = { ok: true };
export type OpenCodeStartFailed = { ok: false; error: string };
export type OpenCodeStartResult = OpenCodeStartOk | OpenCodeStartFailed;

/** Health probe uses `config.get`. Runtime stores full SDK client as `unknown`. */
export type OpenCodeSdkClient = {
  config: { get(options?: Record<string, unknown>): Promise<unknown> };
};

type EmbeddedServer = {
  client: unknown;
  server: { url: string; close(): void };
};

/**
 * Single embedded OpenCode server + SDK client for this extension activation.
 * Uses dynamic import so the ESM-only `@opencode-ai/sdk` loads from our compiled host.
 */
export class OpenCodeRuntime {
  private handle: EmbeddedServer | undefined;
  /** Cliente SDK contra servidor VSOpenCodeX: no llamar `server.close()` al soltar. */
  private attachedViaVsOpenCodeX = false;
  private starting: Promise<OpenCodeStartResult> | undefined;
  /** Retraso antes de cerrar el proceso al volver a Copilot (`scheduleStop`). */
  private stopTimer: ReturnType<typeof setTimeout> | undefined;
  private coldStartBeginMs = 0;
  /** Momento en que `createOpencode` terminó OK (para métricas debug). */
  private serverReadyAtMs = 0;
  private firstHealthPingLogged = false;
  private firstPromptLogged = false;
  /**
   * Monotono: sube al volver a levantar el embedded server o al cerrarlo.
   * Invalida la sesión inline pooled en `opencodeInlineSuggestionSession`.
   */
  private deploymentId = 0;

  get isRunning(): boolean {
    return this.handle !== undefined;
  }

  /** Ms desde que el servidor quedó listo; útil para logs de primer prompt. */
  getMsSinceServerReady(): number | undefined {
    if (!this.handle || !this.serverReadyAtMs) {
      return undefined;
    }
    return Date.now() - this.serverReadyAtMs;
  }

  /** Full `@opencode-ai/sdk` client (typed opaquely to avoid ESM/CJS type import issues). */
  getClient(): unknown {
    return this.handle?.client;
  }

  getBaseUrl(): string | undefined {
    return this.handle?.server.url;
  }

  getDeploymentId(): number {
    return this.deploymentId;
  }

  async start(): Promise<OpenCodeStartResult> {
    this.cancelScheduledStop();
    if (this.handle) {
      return { ok: true };
    }
    if (this.starting) {
      return this.starting;
    }
    this.starting = this.doStart();
    try {
      return await this.starting;
    } finally {
      this.starting = undefined;
    }
  }

  private async doStart(): Promise<OpenCodeStartResult> {
    this.coldStartBeginMs = Date.now();
    logOpenCodeDebug("opencodex-attach-begin");

    const gp = vscode.workspace.getConfiguration("ghostPrompt");
    const preferVsOpenCodeX =
      gp.get<boolean>("preferVsOpenCodeXOpenCode", true) !== false;
    const probeDelayMs = Math.min(
      3000,
      Math.max(0, gp.get<number>("vsOpenCodeXProbeDelayMs", 800)),
    );
    const vsxMaxAttempts = Math.min(
      25,
      Math.max(1, Math.round(gp.get<number>("vsOpenCodeXConnectionMaxAttempts", 8))),
    );
    const vsxRetryGapMs = Math.min(
      8000,
      Math.max(100, gp.get<number>("vsOpenCodeXConnectionRetryGapMs", 650)),
    );

    if (preferVsOpenCodeX) {
      const vsxExt = vscode.extensions.getExtension(VS_OPEN_CODE_X_EXTENSION_ID);
      const maxVsxAttempts = vsxExt ? vsxMaxAttempts : 1;
      logOpenCodeDebug(
        "vsopencodex-probe-start",
        `maxAttempts=${maxVsxAttempts} probeDelayMs=${probeDelayMs} retryGapMs=${vsxRetryGapMs}`,
      );
      for (let attempt = 0; attempt < maxVsxAttempts; attempt++) {
        const bridged = await tryCreateSdkClientViaVsOpenCodeX({
          probeDelayMs,
          attemptIndex: attempt,
          retryGapMs: vsxRetryGapMs,
        });
        if (bridged) {
          this.attachedViaVsOpenCodeX = true;
          this.handle = {
            client: bridged.client,
            server: {
              url: bridged.baseUrl,
              close: () => {
                logOpenCodeDebug("external-opencode-skip-close");
              },
            },
          };
          this.deploymentId += 1;
          const readyMs = Date.now();
          this.serverReadyAtMs = readyMs;
          this.firstHealthPingLogged = false;
          this.firstPromptLogged = false;
          logOpenCodeDebug(
            "cold-start-complete-vsopencodex",
            `attempt=${attempt} elapsedMs=${readyMs - this.coldStartBeginMs}`,
          );
          return { ok: true };
        }
      }
      if (vsxExt) {
        logOpenCodeDebug(
          "vsopencodex-probe-exhausted-no-embedded",
          "VSOpenCodeX installed; skip embedded opencode serve",
        );
        return {
          ok: false,
          error:
            "OpenCode: VSOpenCodeX está instalado pero no devolvió conexión tras varios intentos. Abre el chat o el servidor en VSOpenCodeX. GhostPrompt no inicia un segundo opencode en el puerto compartido. Para usar solo el servidor embebido, desactiva ghostPrompt.preferVsOpenCodeXOpenCode.",
        };
      }
      logOpenCodeDebug("vsopencodex-not-installed-fallback-embedded");
    }

    this.attachedViaVsOpenCodeX = false;
    logOpenCodeDebug("cold-start-begin");
    ensureNodeFetchDuplex();
    const cli = await checkOpenCodeCli();
    if (!cli.ok) {
      logOpenCodeDebug("cold-start-aborted-cli", cli.reason);
      return { ok: false, error: cli.reason };
    }

    try {
      const { createOpencode } = await import("@opencode-ai/sdk");
      const { client, server } = await createOpencode({
        hostname: "127.0.0.1",
        port: GHOST_PROMPT_OPENCODE_PORT,
        timeout: 60_000,
      });
      this.attachedViaVsOpenCodeX = false;
      this.handle = {
        client,
        server,
      };
      this.deploymentId += 1;
      const readyMs = Date.now();
      this.serverReadyAtMs = readyMs;
      this.firstHealthPingLogged = false;
      this.firstPromptLogged = false;
      logOpenCodeDebug(
        "cold-start-complete",
        `elapsedMs=${readyMs - this.coldStartBeginMs}`,
      );
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logOpenCodeDebug("cold-start-failed", msg);
      return {
        ok: false,
        error: `Failed to start OpenCode server: ${msg}`,
      };
    }
  }

  /**
   * Lightweight reachability check (SDK surface differs by version; config.get is a simple ping).
   */
  async isHealthy(): Promise<boolean> {
    if (!this.handle) {
      return false;
    }
    try {
      await (this.handle.client as OpenCodeSdkClient).config.get();
      if (!this.firstHealthPingLogged) {
        this.firstHealthPingLogged = true;
        const sinceReady =
          this.serverReadyAtMs > 0 ? Date.now() - this.serverReadyAtMs : 0;
        const sinceCold =
          this.coldStartBeginMs > 0 ? Date.now() - this.coldStartBeginMs : 0;
        logOpenCodeDebug(
          "first-config-get",
          `msSinceServerReady=${sinceReady} elapsedSinceColdStartMs=${sinceCold}`,
        );
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Primer `session.prompt` tras un arranque (debug): latencia percibida hasta el modelo.
   */
  logDebugFirstPrompt(): void {
    if (this.firstPromptLogged) {
      return;
    }
    this.firstPromptLogged = true;
    const ms = this.getMsSinceServerReady();
    logOpenCodeDebug(
      "first-session-prompt",
      ms !== undefined ? `msSinceServerReady=${ms}` : undefined,
    );
  }

  /**
   * Programa cierre del servidor tras un delay (p. ej. al cambiar a Copilot).
   * No-op si no hay servidor.
   */
  scheduleStop(delayMs: number = OPENCODE_STOP_DEBOUNCE_MS): void {
    this.cancelScheduledStop();
    if (!this.handle) {
      return;
    }
    logOpenCodeDebug("schedule-stop", `delayMs=${delayMs}`);
    this.stopTimer = setTimeout(() => {
      this.stopTimer = undefined;
      logOpenCodeDebug("debounced-stop-fired");
      this.closeServerAndClearState();
    }, delayMs);
  }

  cancelScheduledStop(): void {
    if (this.stopTimer !== undefined) {
      clearTimeout(this.stopTimer);
      this.stopTimer = undefined;
      logOpenCodeDebug("schedule-stop-cancelled");
    }
  }

  /**
   * Cierre inmediato (p. ej. `deactivate`). Cancela cualquier `scheduleStop` pendiente.
   */
  stop(): void {
    this.cancelScheduledStop();
    this.closeServerAndClearState();
  }

  private closeServerAndClearState(): void {
    if (!this.handle) {
      return;
    }
    const skipClose = this.attachedViaVsOpenCodeX;
    this.deploymentId += 1;
    emitOpenCodeServerWillReset();
    try {
      if (skipClose) {
        logOpenCodeDebug("detach-vsopencodex-client");
      } else {
        this.handle.server.close();
      }
    } finally {
      this.handle = undefined;
      this.attachedViaVsOpenCodeX = false;
      this.serverReadyAtMs = 0;
      this.coldStartBeginMs = 0;
      this.firstHealthPingLogged = false;
      this.firstPromptLogged = false;
    }
  }
}

let singleton: OpenCodeRuntime | undefined;

export function getOpenCodeRuntime(): OpenCodeRuntime {
  singleton ??= new OpenCodeRuntime();
  return singleton;
}
