/**
 * Snapshot en memoria de `config.providers()` del SDK OpenCode.
 * Single-flight entre llamadas concurrentes; invalidación coherent con `invalidateOpenCodeProvidersSnapshot`.
 */

import { logOpenCodePerfCapture } from "../debug/SuggestionDebug";

export type OpenCodeProvidersSnapshot = {
  providers?: Array<{
    id: string;
    name?: string;
    models?: unknown;
  }>;
  default?: Record<string, string>;
};

type ProvidersClient = {
  config: { providers(): Promise<unknown> };
};

function readSdkData(result: unknown): unknown {
  if (result && typeof result === "object" && "data" in result) {
    return (result as { data: unknown }).data;
  }
  return undefined;
}

/** Se incrementa al invalidar para no escribir caché con respuestas obsoletas. */
let cacheGeneration = 0;
/** Distinto de comprobar sólo `cachedValue !== undefined`: el SDK puede devolver payload vacío válido. */
let cacheValid = false;
let cachedValue: OpenCodeProvidersSnapshot | undefined;

let pendingFetch: Promise<OpenCodeProvidersSnapshot | undefined> | null = null;

export type OpenCodeProvidersSnapshotPerfOptions = {
  perfCaptureId?: number;
};

/**
 * Obliga a releer desde la red (p. ej. en `deactivate` de la extensión).
 */
export function invalidateOpenCodeProvidersSnapshot(): void {
  cacheGeneration += 1;
  cacheValid = false;
  cachedValue = undefined;
}

async function fetchProvidersFromNetwork(
  client: ProvidersClient,
  /** Generación vigente al iniciar este fetch; si `invalidate` corre antes del fin, no se marca caché válida. */
  generationAtFetchStart: number,
  perfCaptureId?: number,
): Promise<OpenCodeProvidersSnapshot | undefined> {
  const usePerf = typeof performance !== "undefined";
  const t0Net = usePerf ? performance.now() : Date.now();
  try {
    const raw = await client.config.providers();
    if (perfCaptureId !== undefined) {
      const elapsed = usePerf ? performance.now() - t0Net : Date.now() - t0Net;
      logOpenCodePerfCapture(
        perfCaptureId,
        "providers-network-fetch-ms",
        `fetchMs=${Math.round(elapsed)}`,
      );
    }

    const data = readSdkData(raw) as OpenCodeProvidersSnapshot | undefined;
    if (generationAtFetchStart === cacheGeneration) {
      cachedValue = data;
      cacheValid = true;
    }
    return data;
  } catch {
    return undefined;
  }
}

/**
 * Snapshot de proveedores; concurrentes comparten una sola llamada salvo invalidez vista al terminar,
 * caso en que se intenta una segunda lectura cuando haga falta.
 */
export async function getOpenCodeProvidersSnapshot(
  client: ProvidersClient,
  perf?: OpenCodeProvidersSnapshotPerfOptions,
): Promise<OpenCodeProvidersSnapshot | undefined> {
  const perfCap = perf?.perfCaptureId;
  const usePerf = typeof performance !== "undefined";
  const tGet = usePerf ? performance.now() : Date.now();

  if (cacheValid) {
    if (perfCap !== undefined) {
      const elapsedWhole = usePerf ? performance.now() - tGet : Date.now() - tGet;
      logOpenCodePerfCapture(
        perfCap,
        "providers",
        `source=cache-hit elapsedRoundTripMs=${Math.round(elapsedWhole)}`,
      );
    }
    return cachedValue;
  }

  const genWhenEntered = cacheGeneration;

  pendingFetch ??= ((): Promise<
    OpenCodeProvidersSnapshot | undefined
  > => {
    const generationAtSchedule = cacheGeneration;
    return fetchProvidersFromNetwork(
      client,
      generationAtSchedule,
      perfCap,
    );
  })().finally(() => {
    pendingFetch = null;
  });

  const result = await pendingFetch;

  if (cacheValid) {
    if (perfCap !== undefined) {
      const elapsedWhole = usePerf ? performance.now() - tGet : Date.now() - tGet;
      logOpenCodePerfCapture(
        perfCap,
        "providers",
        `source=resolved-after-await elapsedRoundTripMs=${Math.round(elapsedWhole)}`,
      );
    }
    return cachedValue;
  }
  if (genWhenEntered !== cacheGeneration) {
    return getOpenCodeProvidersSnapshot(client, perf);
  }
  if (perfCap !== undefined) {
    const elapsedMiss = usePerf ? performance.now() - tGet : Date.now() - tGet;
    logOpenCodePerfCapture(
      perfCap,
      "providers",
      `source=miss-no-valid-cache-after-await elapsedRoundTripMs=${Math.round(elapsedMiss)}`,
    );
  }
  return result;
}
