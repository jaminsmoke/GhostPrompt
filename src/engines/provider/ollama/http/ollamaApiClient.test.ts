/**
 * @file Pruebas del cliente de API Ollama.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

const mockFetch = vi.fn<(input: URL | string, init?: RequestInit) => Promise<Response>>();

vi.stubGlobal('fetch', mockFetch);

vitest.afterEach(() => {
  vi.restoreAllMocks();
});

import { listModels, generate } from './ollamaApiClient';

/**
 * Creates a mock fetch Response containing JSON.
 * @param {unknown} data - The body payload to serialize.
 * @param {number} status - The HTTP status code.
 * @returns {unknown} A Response-like object with JSON payload headers.
 */
function makeJsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

vitest.describe('ollamaApiClient listModels', () => {
  vitest.beforeEach(() => {
    mockFetch.mockReset();
  });

  vitest.it('returns models array from /api/tags', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({
        models: [
          { name: 'mistral:latest', 'modified_at': '2024-01-01', size: 100, digest: 'abc' },
          { name: 'llama3:latest', 'modified_at': '2024-01-02', size: 200, digest: 'def' },
        ],
      }),
    );

    const models = await listModels();
    vitest.expect(models).toHaveLength(2);
    vitest.expect(models[0].name).toBe('mistral:latest');
    vitest.expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      vitest.expect.objectContaining({ method: 'GET' }),
    );
  });

  vitest.it('returns empty array when API returns no models field', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}));
    vitest.expect(await listModels()).toEqual([]);
  });

  vitest.it('filters malformed model entries and returns only valid ones', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({
        models: [
          { name: 'mistral:latest', 'modified_at': '2024-01-01', size: 100, digest: 'abc' },
          { name: 'bad-model', 'modified_at': '2024-01-02' },
        ],
      }),
    );

    const models = await listModels();
    vitest.expect(models).toHaveLength(1);
    vitest.expect(models[0].name).toBe('mistral:latest');
  });

  vitest.it('throws on non-ok HTTP status', async () => {
    mockFetch.mockResolvedValue(
      new Response(undefined, { status: 500, statusText: 'Internal Server Error' }),
    );
    await vitest.expect(listModels()).rejects.toThrow('Ollama HTTP 500');
  });

  vitest.it('uses custom baseUrl when provided', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ models: [] }));
    await listModels({ baseUrl: 'http://my-ollama:8080' });
    vitest.expect(mockFetch).toHaveBeenCalledWith('http://my-ollama:8080/api/tags', vitest.expect.anything());
  });

  vitest.it('throws on fetch network error', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    await vitest.expect(listModels()).rejects.toThrow('ECONNREFUSED');
  });
});

vitest.describe('ollamaApiClient generate', () => {
  vitest.beforeEach(() => {
    mockFetch.mockReset();
  });

  vitest.it('returns response text from non-streaming generation', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ model: 'mistral:latest', response: 'Hello!', done: true }),
    );

    const text = await generate('Hi', 'mistral:latest');
    vitest.expect(text).toBe('Hello!');
    const [, init] = mockFetch.mock.calls[0] ?? [];
    vitest.expect(init).toMatchObject({ method: 'POST' });
    const body = init?.body;
    if (typeof body !== 'string') {
      throw new TypeError('expected string request body');
    }
    vitest.expect(body).toContain('"stream":false');
  });

  vitest.it('returns empty string when response field is missing', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ model: 'mistral:latest', done: true }));
    vitest.expect(await generate('Hi', 'mistral:latest')).toBe('');
  });

  vitest.it('returns empty string for malformed non-stream response objects', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ foo: 'bar' }));
    vitest.expect(await generate('Hi', 'mistral:latest')).toBe('');
  });

  vitest.it('skips malformed streaming chunk lines and returns accumulated text', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"response":"Hi"}\n'));
        controller.enqueue(new TextEncoder().encode('this-is-not-json\n'));
        controller.enqueue(new TextEncoder().encode('{"response":" there"}\n'));
        controller.close();
      },
    });
    mockFetch.mockResolvedValue(new Response(stream, { status: 200 }));

    const preview = vi.fn();
    const text = await generate('Hi', 'mistral:latest', { onStreamPreview: preview });

    vitest.expect(text).toBe('Hi there');
    vitest.expect(preview).toHaveBeenLastCalledWith('Hi there');
  });

  vitest.it('throws on non-ok HTTP status', async () => {
    mockFetch.mockResolvedValue(new Response(undefined, { status: 400, statusText: 'Bad Request' }));
    await vitest.expect(generate('Hi', 'mistral:latest')).rejects.toThrow('Ollama HTTP 400');
  });

  vitest.it('propagates abort signal when provided', async () => {
    const controller = new AbortController();
    mockFetch.mockImplementation((_url: URL | string, init?: RequestInit) => {
      const signal = init?.signal;
      vitest.expect(signal).toBeDefined();
      vitest.expect(signal?.aborted).toBe(false);
      controller.abort();
      vitest.expect(signal?.aborted).toBe(true);
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });
    await vitest.expect(generate('Hi', 'mistral:latest', { signal: controller.signal })).rejects.toThrow();
  });
});
