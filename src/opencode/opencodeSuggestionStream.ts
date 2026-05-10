/**
 * SSE `/event`: acumula solo deltas de partes `text` (salida), ignora `reasoning`, etc.
 * Vista previa opcional; ver `Docs/ARCHITECTURE.md` §3 — Eficiencia de llamadas inline (OpenCode).
 */
import {
  isSuggestionDebugEnabled,
  logOpenCodeDebug,
} from "../debug/SuggestionDebug";
import {
  foldSuggestionStreamEvent,
  unwrapNormalizedSseEvent,
  type SuggestionStreamFoldState,
} from "./opencodeSuggestionStreamFold";

export type { SuggestionStreamFoldState } from "./opencodeSuggestionStreamFold";
export {
  foldSuggestionStreamEvent,
  unwrapNormalizedSseEvent,
} from "./opencodeSuggestionStreamFold";

type ClientWithEventSubscribe = {
  event: {
    subscribe(opts?: {
      signal?: AbortSignal;
    }): Promise<{ stream: AsyncIterable<unknown> }>;
  };
};

function asSubscribeClient(client: unknown): ClientWithEventSubscribe | undefined {
  if (!client || typeof client !== "object") {
    return undefined;
  }
  const ev = (client as Record<string, unknown>).event as
    | Record<string, unknown>
    | undefined;
  if (!ev || typeof ev.subscribe !== "function") {
    return undefined;
  }
  return client as ClientWithEventSubscribe;
}

/**
 * Una sola suscripción GET `/event`. Vista previa acotada a `maxPreviewChars`.
 */
export async function consumeOpencodeSuggestionTextStream(
  client: unknown,
  signal: AbortSignal,
  onPreview: (accumulated: string) => void,
  options?: { maxPreviewChars?: number; sessionId?: string },
): Promise<void> {
  const maxPreviewChars = options?.maxPreviewChars ?? 500;
  const sessionIdFilter = options?.sessionId;
  const sse = asSubscribeClient(client);
  if (!sse) {
    return;
  }

  let state: SuggestionStreamFoldState = {
    partKinds: new Map(),
    buffer: "",
  };
  let debugEvents = 0;

  try {
    const { stream } = await sse.event.subscribe({ signal });
    for await (const data of stream) {
      if (signal.aborted) {
        break;
      }
      if (sessionIdFilter) {
        const ev = unwrapNormalizedSseEvent(data);
        const sid = ev?.properties.sessionID;
        if (typeof sid === "string" && sid !== sessionIdFilter) {
          continue;
        }
      }
      const prevLen = state.buffer.length;
      state = foldSuggestionStreamEvent(state, data);

      if (isSuggestionDebugEnabled() && debugEvents < 12) {
        const ev = unwrapNormalizedSseEvent(data);
        if (ev?.eventType === "message.part.delta" && state.buffer.length !== prevLen) {
          debugEvents += 1;
          logOpenCodeDebug(
            "sse-preview-delta",
            `bufferLen=${state.buffer.length}`,
          );
        }
      }

      if (state.buffer.length !== prevLen) {
        const clipped =
          state.buffer.length > maxPreviewChars
            ? state.buffer.slice(0, maxPreviewChars)
            : state.buffer;
        onPreview(clipped);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (signal.aborted || /abort/i.test(msg)) {
      return;
    }
    if (isSuggestionDebugEnabled()) {
      logOpenCodeDebug("sse-preview-error", msg);
    }
  }
}
