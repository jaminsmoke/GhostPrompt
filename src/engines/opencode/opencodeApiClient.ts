/**
 * @file Cliente HTTP/SDK de OpenCode: sesiones, prompts y streaming.
 */
export const OPENCODE_DEFAULT_PORT = 4096;

export interface OpenCodeClientOptions {
  port?: number;
  hostname?: string;
  authToken?: string;
}

/** Subconjunto tipado del cliente `@opencode-ai/sdk` usado por GhostPrompt. */
export interface OpenCodeSdkClient {
  config: {
    get: () => Promise<unknown>;
  };
  session: {
    create: (opts?: unknown) => Promise<unknown>;
    prompt: (opts: unknown) => Promise<unknown>;
    delete: (opts: unknown) => Promise<unknown>;
  };
  event: {
    subscribe: (opts: {
      signal: AbortSignal;
    }) => Promise<{ stream: AsyncIterable<unknown> }>;
  };
}

interface PoolEntry {
  sessionId: string;
  lastUsed: number;
}

const POOL_TTL_MS = 5 * 60 * 1000;
const POOL_MAX_SIZE = 4;

let globalClient: OpenCodeSdkClient | undefined;
let sessionPool: PoolEntry[] = [];

/**
 * Construye la URL base del cliente OpenCode.
 * @param {OpenCodeClientOptions} options Opciones de cliente que incluyen host y puerto.
 * @returns {string} URL base HTTP.
 */
function buildBaseUrl(options: OpenCodeClientOptions): string {
  const hostname = options.hostname ?? '127.0.0.1';
  const port = options.port ?? OPENCODE_DEFAULT_PORT;
  return `http://${hostname}:${port}`;
}

/**
 * Construye las cabeceras HTTP para el cliente OpenCode.
 * @param {OpenCodeClientOptions} options Opciones que pueden incluir token de autenticación.
 * @returns {Record<string, string>} Cabeceras de petición.
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
 * @param {OpenCodeClientOptions} options Opciones de configuración de cliente.
 * @returns {Promise<OpenCodeSdkClient>} Instancia de cliente OpenCode.
 */
export async function createOpenCodeClient(
  options: OpenCodeClientOptions,
): Promise<OpenCodeSdkClient> {
  const baseUrl = buildBaseUrl(options);
  const headers = buildHeaders(options);
  const { createOpencodeClient: factory } = await import('@opencode-ai/sdk');
  globalClient = factory({ baseUrl, headers }) as OpenCodeSdkClient;
  return globalClient;
}

/**
 * Devuelve la instancia global del cliente OpenCode.
 * @throws {Error} Si el cliente no está inicializado.
 * @returns {OpenCodeSdkClient} Cliente global previamente inicializado.
 */
export function getGlobalClient(): OpenCodeSdkClient {
  if (!globalClient) {
    throw new Error('OpenCode client no inicializado. Llama a createOpenCodeClient primero.');
  }
  return globalClient;
}

/**
 * Verifica la salud de la conexión OpenCode.
 * @param {OpenCodeSdkClient} [client] Cliente OpenCode opcional; usa el global si no se pasa.
 * @returns {Promise<boolean>} True si la conexión es válida.
 */
export async function healthCheck(client?: OpenCodeSdkClient): Promise<boolean> {
  const c = client ?? getGlobalClient();
  try {
    await c.config.get();
    return true;
  } catch {
    return false;
  }
}

/**
 * Crea una sesión OpenCode interna usando el cliente proporcionado.
 * @param {OpenCodeSdkClient} client Cliente OpenCode.
 * @returns {Promise<string>} ID de sesión creado.
 */
async function createSessionInternal(client: OpenCodeSdkClient): Promise<string> {
  const result = await client.session.create();
  return extractSessionId(result);
}

/**
 * Elimina una sesión OpenCode interna.
 * @param {string} sessionId ID de sesión a eliminar.
 * @param {OpenCodeSdkClient} client Cliente OpenCode.
 * @returns {Promise<void>} Promise que indica cuando la sesión se ha eliminado.
 */
async function deleteSessionInternal(sessionId: string, client: OpenCodeSdkClient): Promise<void> {
  await client.session.delete({
    path: { id: sessionId },
  });
}

/**
 * Envía un prompt de OpenCode a una sesión existente.
 * @param {string} sessionId ID de la sesión de OpenCode.
 * @param {{ providerID: string; modelID: string }} model Modelo objetivo con providerID y modelID.
 * @param {string} model.providerID Identificador del proveedor OpenCode.
 * @param {string} model.modelID Identificador del modelo OpenCode.
 * @param {Array<{ type: string; text: string }>} parts Partes del mensaje a enviar.
 * @param {OpenCodeSdkClient} [client] Cliente OpenCode opcional.
 * @returns {Promise<string>} Texto generado por la petición.
 */
export async function promptOpenCode(
  sessionId: string,
  model: { providerID: string; modelID: string },
  parts: Array<{ type: string; text: string }>,
  client?: OpenCodeSdkClient,
): Promise<string> {
  const c = client ?? getGlobalClient();
  const result = await c.session.prompt({
    path: { id: sessionId },
    body: { model, parts },
  });
  return extractPromptText(result);
}

/**
 * Crea un stream de texto para una sesión OpenCode.
 * @param {string} _sessionId ID de sesión de OpenCode.
 * @param {globalThis.AbortSignal} signal Señal de abort para cancelar el stream.
 * @param {OpenCodeSdkClient} [client] Cliente OpenCode opcional.
 * @yields {string} Fragmentos de texto incremental del stream OpenCode.
 * @returns {AsyncGenerator<string>} Generador asíncrono de texto incremental.
 */
export async function* promptStreamOpenCode(
  _sessionId: string,
  signal: AbortSignal,
  client?: OpenCodeSdkClient,
): AsyncGenerator<string> {
  const c = client ?? getGlobalClient();
  const { stream } = await c.event.subscribe({ signal });
  for await (const data of stream) {
    const text = extractDeltaText(data);
    if (text) {
      yield text;
    }
  }
}

/**
 * Obtiene una sesión OpenCode reutilizando una existente o creando una nueva.
 * @param {OpenCodeSdkClient} [client] Cliente OpenCode opcional.
 * @returns {Promise<string>} ID de sesión disponible.
 */
export async function getSession(client?: OpenCodeSdkClient): Promise<string> {
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
 * @param {OpenCodeSdkClient} [client] Cliente OpenCode opcional.
 * @returns {Promise<void>} Promise que indica cuando se han cerrado las sesiones.
 */
export async function closeAllSessions(client?: OpenCodeSdkClient): Promise<void> {
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
 * @param {PoolEntry} entry Entrada de sesión con la última vez usada.
 * @returns {boolean} True si la sesión excedió el TTL.
 */
function isSessionStale(entry: PoolEntry): boolean {
  return Date.now() - entry.lastUsed > POOL_TTL_MS;
}

/**
 * Elimina sesiones caducadas de la piscina de OpenCode.
 * @returns {void}
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
 * @param {unknown} result Resultado bruto devuelto por la API.
 * @returns {string} ID de sesión o cadena vacía si no se encuentra.
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
 * @param {unknown} result Resultado bruto de la API.
 * @returns {string} Texto concatenado del prompt.
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
 * @param {unknown} data Evento bruto de stream.
 * @returns {string | undefined} Texto delta o undefined si no hay texto.
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
