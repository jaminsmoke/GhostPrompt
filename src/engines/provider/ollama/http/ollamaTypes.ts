/**
 * @file Tipos de datos de la API Ollama.
 */
export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: Record<string, unknown>;
  system?: string;
  template?: string;
  context?: number[];
  raw?: boolean;
  format?: string;
  ['keep_alive']?: string;
}

export interface OllamaGenerateResponse {
  model: string;
  ['created_at']: string;
  response: string;
  done: boolean;
  context?: number[];
  ['total_duration']?: number;
  ['load_duration']?: number;
  ['prompt_eval_count']?: number;
  ['prompt_eval_duration']?: number;
  ['eval_count']?: number;
  ['eval_duration']?: number;
}

export interface OllamaModel {
  name: string;
  ['modified_at']: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    families: string[];
    ['parameter_size']: string;
    ['quantization_level']: string;
  };
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

export interface OllamaShowRequest {
  model: string;
}

export interface OllamaModelDetails {
  license: string;
  modelfile: string;
  parameters: string;
  template: string;
  details: {
    ['parent_model']: string;
    format: string;
    family: string;
    families: string[];
    ['parameter_size']: string;
    ['quantization_level']: string;
  };
  ['model_info']: Record<string, unknown>;
}

export type OllamaClientOptions = {
  baseUrl?: string;
  signal?: AbortSignal;
  requestTimeoutMs?: number;
};
