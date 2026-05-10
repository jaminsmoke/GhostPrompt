/**
 * Spike opcional: durante `session.prompt`, si debug está activo, escucha SSE
 * `/global/event` y `/event` y escribe muestras en el canal GhostPrompt Suggestions.
 */
import { logOpenCodeDebug } from "../debug/SuggestionDebug";
import { summarizeSsePayloadForDebug } from "./opencodeSsePayloadSummary";

const MAX_EVENTS_PER_CHANNEL = 80;

export { summarizeSsePayloadForDebug } from "./opencodeSsePayloadSummary";

type ClientWithSseStreams = {
  global: {
    event(opts?: {
      signal?: AbortSignal;
    }): Promise<{ stream: AsyncIterable<unknown> }>;
  };
  event: {
    subscribe(opts?: {
      signal?: AbortSignal;
    }): Promise<{ stream: AsyncIterable<unknown> }>;
  };
};

function asSseClient(client: unknown): ClientWithSseStreams | undefined {
  if (!client || typeof client !== "object") {
    return undefined;
  }
  const o = client as Record<string, unknown>;
  const g = o.global as Record<string, unknown> | undefined;
  const ev = o.event as Record<string, unknown> | undefined;
  if (typeof g?.event !== "function" || typeof ev?.subscribe !== "function") {
    return undefined;
  }
  return client as ClientWithSseStreams;
}

async function drainSseChannel(
  label: string,
  open: () => Promise<{ stream: AsyncIterable<unknown> }>,
  signal: AbortSignal,
): Promise<void> {
  let count = 0;
  try {
    const { stream } = await open();
    for await (const data of stream) {
      if (signal.aborted) {
        break;
      }
      count += 1;
      if (count <= MAX_EVENTS_PER_CHANNEL) {
        logOpenCodeDebug(label, summarizeSsePayloadForDebug(data));
      } else if (count === MAX_EVENTS_PER_CHANNEL + 1) {
        logOpenCodeDebug(
          label,
          `…truncado (${MAX_EVENTS_PER_CHANNEL} eventos registrados)`,
        );
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (signal.aborted || /abort/i.test(msg)) {
      return;
    }
    logOpenCodeDebug(`${label}-error`, msg);
  }
}

/**
 * Lanza dos lecturas SSE en paralelo hasta que `signal` aborta (fin de prompt o cancelación).
 * No bloquea al llamante.
 */
export function startOpencodeSseDebugCapture(
  client: unknown,
  signal: AbortSignal,
): void {
  const sse = asSseClient(client);
  if (!sse) {
    logOpenCodeDebug(
      "sse-spike-skip",
      "client sin global.event / event.subscribe",
    );
    return;
  }

  logOpenCodeDebug(
    "sse-spike-start",
    "GET /global/event y GET /event durante session.prompt",
  );

  void drainSseChannel("sse-/global/event", () => sse.global.event({ signal }), signal);
  void drainSseChannel("sse-/event", () => sse.event.subscribe({ signal }), signal);
}
