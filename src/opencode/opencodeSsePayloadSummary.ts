const MAX_JSON_CHARS = 1200;

/** Serialización acotada para logs de depuración SSE (sin dependencias de VS Code). */
export function summarizeSsePayloadForDebug(data: unknown): string {
  if (data === null || data === undefined) {
    return String(data);
  }
  if (typeof data === "string") {
    return data.length > MAX_JSON_CHARS
      ? `${data.slice(0, MAX_JSON_CHARS)}…`
      : data;
  }
  try {
    const s = JSON.stringify(data);
    return s.length > MAX_JSON_CHARS ? `${s.slice(0, MAX_JSON_CHARS)}…` : s;
  } catch {
    return "[unserializable]";
  }
}
