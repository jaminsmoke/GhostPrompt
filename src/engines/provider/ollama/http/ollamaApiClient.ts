/**
 * @file Cliente ligero para la API de Ollama.
 */
import {
  ollamaGenerateResponseChunkSchema,
  ollamaGenerateResponseSchema,
  ollamaModelSchema,
  ollamaTagsResponseSchema,
} from './ollamaValidators';

import type { OllamaClientOptions, OllamaModel } from './ollamaTypes';

const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Construye una URL completa para una ruta de la API de Ollama.
 * @param {string} path - Ruta del endpoint, incluyendo prefijo '/'.
 * @param {string | undefined} [baseUrl] - URL base opcional de Ollama.
 * @returns {string} URL completa sin barras finales duplicadas.
 */
function resolveUrl(path: string, baseUrl?: string): string {
  const base = (baseUrl ?? DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/u, '');
  return `${base}${path}`;
}

/**
 * Construye las opciones de cabecera y señal para una petición Ollama.
 * @param {OllamaClientOptions} options - Opciones de cliente que pueden incluir señal de cancelación.
 * @returns {object} Cabeceras y señal opcional para fetch.
 */
function buildOptions(options: OllamaClientOptions): {
  headers: Record<string, string>;
  signal?: globalThis.AbortSignal;
} {
  const headers: Record<string, string> = { 'Content-Type': 'application/json',};
  return {
    headers,
    ...options.signal ? { signal: options.signal } : {},
  };
}

/**
 * Realiza una petición fetch y parsea la respuesta JSON con timeout.
 * @param {string} url - URL a la que realizar la petición.
 * @param {globalThis.RequestInit} init - Configuración de la petición fetch.
 * @param {number} timeoutMs - Tiempo máximo en milisegundos antes de abortar.
 * @returns {Promise<T>} Respuesta parseada como JSON genérico.
 */
async function fetchJson<T>(
  url: string,
  init: globalThis.RequestInit,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const mergedSignal = init.signal
    ? anySignal([init.signal, controller.signal])
    : controller.signal;

  try {
    const res = await fetch(url, { ...init, signal: mergedSignal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${res.statusText}`);
    }
    return (await res.json()) as T;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Ollama request timed out or was cancelled', { cause: error });
    }
    throw error;
  }
}

/**
 * Crea una señal combinada que se aborta cuando cualquiera de las señales internas se aborta.
 * @param {globalThis.AbortSignal[]} signals - Señales a combinar.
 * @returns {globalThis.AbortSignal} Señal compuesta de cancelación.
 */
function anySignal(signals: globalThis.AbortSignal[]): globalThis.AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

/**
 * Lista modelos disponibles en la instancia de Ollama.
 * @param {OllamaClientOptions} [options] - Opciones de cliente para la petición.
 * @returns {Promise<OllamaModel[]>} Array de modelos disponibles.
 */
export async function listModels(options: OllamaClientOptions = {}): Promise<OllamaModel[]> {
  const url = resolveUrl('/api/tags', options.baseUrl);
  const { headers, signal } = buildOptions(options);
  const data = await fetchJson<unknown>(
    url,
    { method: 'GET', headers, signal },
    options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  );
  const parsed = ollamaTagsResponseSchema.safeParse(data);
  if (!parsed.success || !Array.isArray(parsed.data.models)) {
    return [];
  }
  const validModels: OllamaModel[] = [];
  for (const candidate of parsed.data.models) {
    const modelParse = ollamaModelSchema.safeParse(candidate);
    if (modelParse.success) {
      validModels.push(modelParse.data);
    }
  }
  return validModels;
}

/**
 * Genera texto desde Ollama usando el prompt y modelo especificados.
 * @param {string} prompt - Texto de entrada para el modelo.
 * @param {string} model - Identificador del modelo Ollama.
 * @param {object} [options] - Opciones de generación y streaming.
 * @returns {Promise<string>} Texto generado completo.
 */
export async function generate(
  prompt: string,
  model: string,
  options: OllamaClientOptions & {
    onStreamPreview?: (text: string) => void;
    system?: string;
    options?: Record<string, unknown>;
  } = {},
): Promise<string> {
  const url = resolveUrl('/api/generate', options.baseUrl);
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  if (options.onStreamPreview) {
    return streamGenerate(prompt, model, url, options, timeoutMs);
  }

  const body: Record<string, unknown> = {
    model,
    prompt,
    stream: false,
  };
  if (options.system) {
    body.system = options.system;
  }
  if (options.options) {
    body.options = options.options;
  }

  const { headers, signal } = buildOptions(options);
  const res = await fetchJson<unknown>(
    url,
    {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

  const parsed = ollamaGenerateResponseSchema.safeParse(res);
  if (!parsed.success) {
    return '';
  }
  return parsed.data.response ?? '';
}

/**
 * Realiza una generación de Ollama por streaming y emite previews.
 * @param {string} prompt - Texto para enviar al modelo.
 * @param {string} model - Modelo Ollama a usar.
 * @param {string} url - URL de la API generate.
 * @param {object} options - Opciones de generación y streaming.
 * @param {number} timeoutMs - Timeout en milisegundos para la operación.
 * @returns {Promise<string>} Texto completo generado.
 */
async function streamGenerate(
  prompt: string,
  model: string,
  url: string,
  options: OllamaClientOptions & {
    onStreamPreview?: (text: string) => void;
    system?: string;
    options?: Record<string, unknown>;
  },
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const signal = options.signal ? anySignal([options.signal, controller.signal]) : controller.signal;

  const body: Record<string, unknown> = {
    model,
    prompt,
    stream: true,
  };
  if (options.system) {
    body.system = options.system;
  }
  if (options.options) {
    body.options = options.options;
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json',};

    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify(body),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${res.statusText}`);
    }

    const reader = res.body?.getReader() as ReadableStreamDefaultReader<Uint8Array> | undefined;
    if (!reader) {
      throw new Error('Ollama stream response body is null');
    }

    const decoder = new TextDecoder();

    const appendLines = (lines: string[], accumulated: string): string => {
      let nextText = accumulated;
      for (const line of lines) {
        if (line.trim()) {
          try {
            const chunk = JSON.parse(line) as unknown;
            const chunkParse = ollamaGenerateResponseChunkSchema.safeParse(chunk);
            if (chunkParse.success && chunkParse.data.response) {
              nextText += chunkParse.data.response;
              options.onStreamPreview?.(nextText);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
      return nextText;
    };

    const pumpStream = async (accumulated: string, pending: string): Promise<string> => {
      const readResult = await reader.read();
      if (readResult.done) {
        return accumulated;
      }
      const combined = pending + decoder.decode(readResult.value, { stream: true });
      const lines = combined.split('\n');
      const remainder = lines.pop() ?? '';
      return pumpStream(appendLines(lines, accumulated), remainder);
    };

    return await pumpStream('', '');
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Ollama request timed out or was cancelled', { cause: error });
    }
    throw error;
  }
}
