/**
 * Plegado de eventos SSE OpenCode (sin dependencias de VS Code — testable en Vitest).
 */

export type SuggestionStreamFoldState = {
  partKinds: Map<string, string>;
  buffer: string;
};

/** Normaliza payload envuelto (`/global/event`) vs plano (`/event`). */
export function unwrapNormalizedSseEvent(data: unknown): {
  eventType: string;
  properties: Record<string, unknown>;
} | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const o = data as Record<string, unknown>;
  const payload = o.payload;
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const t = p.type;
    const props = p.properties;
    if (typeof t === "string" && props && typeof props === "object") {
      return { eventType: t, properties: props as Record<string, unknown> };
    }
    return undefined;
  }
  const t = o.type;
  const props = o.properties;
  if (typeof t === "string" && props && typeof props === "object") {
    return { eventType: t, properties: props as Record<string, unknown> };
  }
  return undefined;
}

export function foldSuggestionStreamEvent(
  state: SuggestionStreamFoldState,
  data: unknown,
): SuggestionStreamFoldState {
  const ev = unwrapNormalizedSseEvent(data);
  if (!ev) {
    return state;
  }

  if (ev.eventType === "message.part.updated") {
    const part = ev.properties.part as { id?: string; type?: string } | undefined;
    if (part?.id && typeof part.type === "string") {
      const partKinds = new Map(state.partKinds);
      partKinds.set(part.id, part.type);
      return { partKinds, buffer: state.buffer };
    }
    return state;
  }

  if (ev.eventType !== "message.part.delta") {
    return state;
  }
  if (ev.properties.field !== "text") {
    return state;
  }
  const pid = ev.properties.partID;
  if (typeof pid !== "string") {
    return state;
  }
  if (state.partKinds.get(pid) !== "text") {
    return state;
  }
  const delta = ev.properties.delta;
  if (typeof delta !== "string" || delta.length === 0) {
    return state;
  }
  return {
    partKinds: state.partKinds,
    buffer: state.buffer + delta,
  };
}
