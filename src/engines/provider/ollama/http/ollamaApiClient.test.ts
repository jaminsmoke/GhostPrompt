/**
 * @file Pruebas del cliente de API Ollama.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

vi.stubGlobal('fetch', mockFetch);

afterEach(() => {
  vi.restoreAllMocks();
});

import { listModels, generate } from './ollamaApiClient';

/**
 * Creates a mock fetch Response containing JSON.
 * @param {unknown} data The body payload to serialize.
 * @param {number} status The HTTP status code.
 * @returns {unknown} A Response-like object with JSON payload headers.
 */
function makeJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ollamaApiClient listModels', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns models array from /api/tags', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({
        models: [
          { name: 'mistral:latest', ['modified_at']: '2024-01-01', size: 100, digest: 'abc' },
          { name: 'llama3:latest', ['modified_at']: '2024-01-02', size: 200, digest: 'def' },
        ],
      }),
    );

    const models = await listModels();
    expect(models).toHaveLength(2);
    expect(models[0].name).toBe('mistral:latest');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns empty array when API returns no models field', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}));
    expect(await listModels()).toEqual([]);
  });

  it('filters malformed model entries and returns only valid ones', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({
        models: [
          { name: 'mistral:latest', ['modified_at']: '2024-01-01', size: 100, digest: 'abc' },
          { name: 'bad-model', ['modified_at']: '2024-01-02' },
        ],
      }),
    );

    const models = await listModels();
    expect(models).toHaveLength(1);
    expect(models[0].name).toBe('mistral:latest');
  });

  it('throws on non-ok HTTP status', async () => {
    mockFetch.mockResolvedValue(
      new Response(null, { status: 500, statusText: 'Internal Server Error' }),
    );
    await expect(listModels()).rejects.toThrow('Ollama HTTP 500');
  });

  it('uses custom baseUrl when provided', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ models: [] }));
    await listModels({ baseUrl: 'http://my-ollama:8080' });
    expect(mockFetch).toHaveBeenCalledWith('http://my-ollama:8080/api/tags', expect.anything());
  });

  it('throws on fetch network error', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(listModels()).rejects.toThrow('ECONNREFUSED');
  });
});

describe('ollamaApiClient generate', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns response text from non-streaming generation', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ model: 'mistral:latest', response: 'Hello!', done: true }),
    );

    const text = await generate('Hi', 'mistral:latest');
    expect(text).toBe('Hello!');
    const [[, init]] = mockFetch.mock.calls as [RequestInfo | URL, RequestInit?][];
    expect(init).toMatchObject({ method: 'POST' });
    expect(String(init?.body)).toContain('"stream":false');
  });

  it('returns empty string when response field is missing', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ model: 'mistral:latest', done: true }));
    expect(await generate('Hi', 'mistral:latest')).toBe('');
  });

  it('returns empty string for malformed non-stream response objects', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ foo: 'bar' }));
    expect(await generate('Hi', 'mistral:latest')).toBe('');
  });

  it('skips malformed streaming chunk lines and returns accumulated text', async () => {
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

    expect(text).toBe('Hi there');
    expect(preview).toHaveBeenLastCalledWith('Hi there');
  });

  it('throws on non-ok HTTP status', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 400, statusText: 'Bad Request' }));
    await expect(generate('Hi', 'mistral:latest')).rejects.toThrow('Ollama HTTP 400');
  });

  it('propagates abort signal when provided', async () => {
    const controller = new AbortController();
    mockFetch.mockImplementation((_url: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      expect(signal).toBeDefined();
      expect(signal?.aborted).toBe(false);
      controller.abort();
      expect(signal?.aborted).toBe(true);
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });
    await expect(generate('Hi', 'mistral:latest', { signal: controller.signal })).rejects.toThrow();
  });
});
