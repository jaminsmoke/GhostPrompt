/**
 * Sesión OpenCode compartida para suggestions inline (fase H): un `session.create` por ciclo
 * de `deploymentId` en lugar de por cada keystroke cuando el servidor embedded sigue estable.
 *
 * Reset: `emitOpenCodeServerWillReset` (pre-close), bump de deployment, nonce en invalidaciones.
 * Ver `Docs/ARCHITECTURE.md` §3 — Eficiencia de llamadas inline (OpenCode).
 */

import { logOpenCodePerfCapture } from "../debug/SuggestionDebug";
import { getOpenCodeRuntime } from "./OpenCodeRuntime";
import { onOpenCodeServerWillReset } from "./openCodeServerLifecycleHooks";
import { unpackOpencodeSessionCreateId } from "./sdkEnvelope";

export type SdkClientWithSession = {
  session: {
    create(body?: unknown): Promise<unknown>;
    delete(options?: { path?: { id?: string } }): Promise<unknown>;
    abort(options?: unknown): Promise<unknown>;
    prompt(options?: unknown): Promise<unknown>;
  };
};

class PoolStaleError extends Error {
  readonly code = "POOL_STALE" as const;
  constructor() {
    super("opencode-inline-session-pool-stale");
    this.name = "PoolStaleError";
  }
}

function isPoolStaleError(e: unknown): boolean {
  return e instanceof PoolStaleError;
}

let pooledSessionId: string | undefined;
let poolDeploymentSnapshot = -1;
/** Incrementa en invalidaciones y pre-close para que un create en vuelo no escriba pool obsoleto. */
let poolNonce = 0;

let createInflight: Promise<string> | null = null;
let inflightDep = -1;
let inflightNonce = -1;

let hookInstalled = false;

export function invalidateOpencodeInlineSuggestionSessionPool(): void {
  pooledSessionId = undefined;
  poolDeploymentSnapshot = -1;
  poolNonce++;
}

function onEmbeddedServerWillClose(): void {
  invalidateOpencodeInlineSuggestionSessionPool();
}

function ensureServerResetHook(): void {
  if (hookInstalled) {
    return;
  }
  hookInstalled = true;
  onOpenCodeServerWillReset(onEmbeddedServerWillClose);
}

/** Id de sesión pooled o recién creada; retries si el servidor churn mid-flight. */
export async function getOrCreateOpencodeInlineSession(
  client: SdkClientWithSession,
  readCreateError: (envelope: unknown) => string | undefined,
  perfCaptureId?: number,
): Promise<string> {
  ensureServerResetHook();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const deploymentId = getOpenCodeRuntime().getDeploymentId();

    if (pooledSessionId && poolDeploymentSnapshot === deploymentId) {
      if (perfCaptureId !== undefined) {
        logOpenCodePerfCapture(
          perfCaptureId,
          "inline-session",
          "source=pooled-reused",
        );
      }
      return pooledSessionId;
    }

    if (
      createInflight === null ||
      inflightDep !== deploymentId ||
      inflightNonce !== poolNonce
    ) {
      const depSchedule = deploymentId;
      const nonceSchedule = poolNonce;

      inflightDep = deploymentId;
      inflightNonce = nonceSchedule;

      createInflight = (async () => {
        const usePerf = typeof performance !== "undefined";
        const tSdk = usePerf ? performance.now() : Date.now();

        const created = await client.session.create({
          body: { title: "GhostPrompt inline suggestion" },
        });

        const envErr = readCreateError(created);
        if (envErr) {
          throw new Error(envErr);
        }

        const id = unpackOpencodeSessionCreateId(created);
        if (!id) {
          throw new Error("Empty session create response");
        }

        const depAfter = getOpenCodeRuntime().getDeploymentId();
        if (nonceSchedule !== poolNonce || depSchedule !== depAfter) {
          throw new PoolStaleError();
        }

        pooledSessionId = id;
        poolDeploymentSnapshot = depSchedule;
        if (perfCaptureId !== undefined) {
          const sdkElapsed = usePerf
            ? performance.now() - tSdk
            : Date.now() - tSdk;
          logOpenCodePerfCapture(
            perfCaptureId,
            "session-create",
            `sdkRoundTripMs=${Math.round(sdkElapsed)}`,
          );
        }
        return id;
      })().finally(() => {
        createInflight = null;
        inflightDep = -1;
        inflightNonce = -1;
      });
    }

    try {
      return await createInflight;
    } catch (e) {
      if (isPoolStaleError(e)) {
        invalidateOpencodeInlineSuggestionSessionPool();
        continue;
      }
      invalidateOpencodeInlineSuggestionSessionPool();
      throw e;
    }
  }

  invalidateOpencodeInlineSuggestionSessionPool();
  throw new Error("OpenCode inline session: max pool retries exceeded");
}

export function peekPooledInlineSessionId(): string | undefined {
  return pooledSessionId;
}
