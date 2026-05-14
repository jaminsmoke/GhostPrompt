import type { SuggestionModelDescriptor } from '../../../core/types';

export type OllamaApiModelRecord = {
  name: string;
  size?: number;
};

/**
 * Comprueba si un valor es un registro de modelo Ollama válido.
 * @param v Valor a validar.
 * @returns True si el valor representa un modelo Ollama válido.
 */
function isValidOllamaModel(v: unknown): v is OllamaApiModelRecord {
  return (
    v !== null &&
    typeof v === 'object' &&
    typeof (v as { name?: unknown }).name === 'string' &&
    (v as { name: string }).name.trim().length > 0
  );
}

/**
 * Normaliza la respuesta de la API de Ollama a registros de modelo válidos.
 * @param models Valor devuelto por la API de Ollama.
 * @returns Array de registros de modelo Ollama válidos.
 */
export function normalizeOllamaModels(models: unknown): OllamaApiModelRecord[] {
  if (models === null || models === undefined) {
    return [];
  }
  if (!Array.isArray(models)) {
    return [];
  }
  return models.filter(isValidOllamaModel);
}

/**
 * Convierte un registro de modelo Ollama en un descriptor de sugerencia.
 * @param model Registro de modelo Ollama válido.
 * @returns Descriptor de modelo para el pipeline de sugerencias.
 */
export function ollamaModelToDescriptor(model: OllamaApiModelRecord): SuggestionModelDescriptor {
  return {
    id: model.name,
    label: model.name,
    tier: 'included',
    provider: 'ollama',
    completionSource: 'ollama',
  };
}
