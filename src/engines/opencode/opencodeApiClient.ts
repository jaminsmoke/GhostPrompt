export const OPENCODE_DEFAULT_PORT = 4096;

export interface OpenCodeClientOptions {
  port?: number;
  hostname?: string;
  authToken?: string;
}

interface PoolEntry {
  sessionId: string;
  lastUsed: number;
}

const POOL_TTL_MS = 5 * 60 * 1000;
const POOL_MAX_SIZE = 4;

let globalClient: unknown | undefined;
let sessionPool: PoolEntry[] = [];

/**
 * Construye la URL base del cliente OpenCode.
 * @param options Opciones de cliente que incluyen host y puerto.
 * @returns URL base HTTP.
 */
function buildBaseUrl(options: OpenCodeClientOptions): string {
  const hostname = options.hostname ?? '127.0.0.1';
  const port = options.port ?? OPENCODE_DEFAULT_PORT;
  return `http://${hostname}:${port}`;
}

/**
 * Construye las cabeceras HTTP para el cliente OpenCode.
 * @param options Opciones que pueden incluir token de autenticación.
 * @returns Cabeceras de petición.
 */
function buildHeaders(options: OpenCodeClientOptions): Record<string, string> {
  const headers: Record<string, string> = {};
  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }
  return headers;
}

/**
 * Crea e inicializa el cliente OpenCode SDK.
 * @param options Opciones de configuración de cliente.
 * @returns Instancia de cliente OpenCode.
 */
export async function createOpenCodeClient(options: OpenCodeClientOptions): Promise<unknown> {
  const baseUrl = buildBaseUrl(options);
  const headers = buildHeaders(options);
  const { createOpencodeClient: factory } = await import('@opencode-ai/sdk');
  globalClient = factory({ baseUrl, headers });
  return globalClient;
}

/**
 * Devuelve la instancia global del cliente OpenCode.
 * @throws Error Si el cliente no está inicializado.
 * @returns Cliente global previamente inicializado.
 */
export function getGlobalClient(): unknown {
  if (!globalClient) {
    throw new Error('OpenCode client no inicializado. Llama a createOpenCodeClient primero.');
  }
  return globalClient;
}

/**
 * Verifica la salud de la conexión OpenCode.
 * @param client Cliente OpenCode opcional; usa el global si no se pasa.
 * @returns True si la conexión es válida.
 */
export async function healthCheck(client?: unknown): Promise<boolean> {
  const c = client ?? getGlobalClient();
  try {
    await (c as { config: { get: () => Promise<unknown> } }).config.get();
    return true;
  } catch {
    return false;
  }
}

/**
 * Crea una sesión OpenCode interna usando el cliente proporcionado.
 * @param client Cliente OpenCode.
 * @returns ID de sesión creado.
 */
async function createSessionInternal(client: unknown): Promise<string> {
  const result = await (
    client as { session: { create: (opts?: unknown) => Promise<unknown> } }
  ).session.create();
  return extractSessionId(result);
}

/**
 * Elimina una sesión OpenCode interna.
 * @param sessionId ID de sesión a eliminar.
 * @param client Cliente OpenCode.
 */
async function deleteSessionInternal(sessionId: string, client: unknown): Promise<void> {
  await (client as { session: { delete: (opts: unknown) => Promise<unknown> } }).session.delete({
    path: { id: sessionId },
  });
}

/**
 * Envía un prompt de OpenCode a una sesión existente.
 * @param sessionId ID de la sesión de OpenCode.
 * @param model Modelo objetivo con providerID y modelID.
 * @param model.providerID Identificador del proveedor OpenCode.
 * @param model.modelID Identificador del modelo OpenCode.
 * @param parts Partes del mensaje a enviar.
 * @param client Cliente OpenCode opcional.
 * @returns Texto generado por la petición.
 */
export async function promptOpenCode(
  sessionId: string,
  model: { providerID: string; modelID: string },
  parts: Array<{ type: string; text: string }>,
  client?: unknown,
): Promise<string> {
  const c = client ?? getGlobalClient();
  const result = await (
    c as { session: { prompt: (opts: unknown) => Promise<unknown> } }
  ).session.prompt({
    path: { id: sessionId },
    body: { model, parts },
  });
  return extractPromptText(result);
}

/**
 * Crea un stream de texto para una sesión OpenCode.
 * @param _sessionId ID de sesión de OpenCode.
 * @param signal Señal de abort para cancelar el stream.
 * @param client Cliente OpenCode opcional.
 * @returns Generador asíncrono de texto incremental.
 */
export async function* promptStreamOpenCode(
  _sessionId: string,
  signal: AbortSignal,
  client?: unknown,
): AsyncGenerator<string> {
  const c = client ?? getGlobalClient();
  const { stream } = await (
    c as {
      event: {
        subscribe: (opts: { signal: AbortSignal }) => Promise<{ stream: AsyncIterable<unknown> }>;
      };
    }
  ).event.subscribe({ signal });
  for await (const data of stream) {
    const text = extractDeltaText(data);
    if (text) {
      yield text;
    }
  }
}

/**
 * Obtiene una sesión OpenCode reutilizando una existente o creando una nueva.
 * @param client Cliente OpenCode opcional.
 * @returns ID de sesión disponible.
 */
export async function getSession(client?: unknown): Promise<string> {
  evictStaleSessions();
  const c = client ?? getGlobalClient();
  const pooled = sessionPool.find((e) => !isSessionStale(e));
  if (pooled) {
    pooled.lastUsed = Date.now();
    return pooled.sessionId;
  }
  if (sessionPool.length >= POOL_MAX_SIZE) {
    const oldest = sessionPool.reduce((a, b) => (a.lastUsed < b.lastUsed ? a : b));
    await deleteSessionInternal(oldest.sessionId, c);
    sessionPool = sessionPool.filter((e) => e !== oldest);
  }
  const sessionId = await createSessionInternal(c);
  sessionPool.push({ sessionId, lastUsed: Date.now() });
  return sessionId;
}

/**
 * Cierra todas las sesiones OpenCode activas en la piscina.
 * @param client Cliente OpenCode opcional.
 */
export async function closeAllSessions(client?: unknown): Promise<void> {
  const c = client ?? getGlobalClient();
  await Promise.all(sessionPool.map((e) => deleteSessionInternal(e.sessionId, c)));
  sessionPool = [];
}

/**
 * Reinicia el cliente OpenCode global eliminando la instancia y los recursos en caché.
 */
export function resetClient(): void {
  globalClient = undefined;
  sessionPool = [];
}

/**
 * Determina si una sesión de OpenCode ha caducado.
 * @param entry Entrada de sesión con la última vez usada.
 * @returns True si la sesión excedió el TTL.
 */
function isSessionStale(entry: PoolEntry): boolean {
  return Date.now() - entry.lastUsed > POOL_TTL_MS;
}

/**
 * Elimina sesiones caducadas de la piscina de OpenCode.
 * @returns Void.
 */
function evictStaleSessions(): void {
  sessionPool = sessionPool.filter((e) => {
    if (isSessionStale(e)) {
      deleteSessionInternal(e.sessionId, getGlobalClient()).catch(() => {});
      return false;
    }
    return true;
  });
}

/**
 * Extrae el ID de sesión del resultado de la API OpenCode.
 * @param result Resultado bruto devuelto por la API.
 * @returns ID de sesión o cadena vacía si no se encuentra.
 */
function extractSessionId(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return '';
  }
  const r = result as { data?: { id?: string } };
  return r.data?.id ?? '';
}

/**
 * Extrae el texto generado del resultado de prompt OpenCode.
 * @param result Resultado bruto de la API.
 * @returns Texto concatenado del prompt.
 */
function extractPromptText(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return '';
  }
  const r = result as { data?: { parts?: Array<{ type?: string; text?: string }> } };
  const parts = r.data?.parts ?? [];
  let text = '';
  for (const p of parts) {
    if (p.type === 'text' && typeof p.text === 'string') {
      text += p.text;
    }
  }
  return text;
}

/**
 * Extrae texto delta de un evento de stream OpenCode.
 * @param data Evento bruto de stream.
 * @returns Texto delta o undefined si no hay texto.
 */
function extractDeltaText(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const d = data as Record<string, unknown>;
  if (d.type !== 'message') {
    return undefined;
  }
  const part = d.part as Record<string, unknown> | undefined;
  if (!part) {
    return undefined;
  }
  if (part.field !== 'text' || typeof part.delta !== 'string') {
    return undefined;
  }
  return part.delta;
}
