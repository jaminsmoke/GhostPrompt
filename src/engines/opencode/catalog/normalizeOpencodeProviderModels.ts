/**
 * @file Normalización de respuestas `config.providers()` de OpenCode.
 *
 * `config.providers()` puede devolver `models` como objeto mapa o como array.
 * Normalizamos sin inventar campos: solo filtramos entradas sin `id` string válido.
 *
 * Capa de integración (no comportamiento del LM). Ver `Docs/ARCHITECTURE.md` §3 — Catálogo OpenCode.
 */

export type RawOpencodeProviderModel = {
  id: string;
  name?: string;
} & Record<string, unknown>;

/**
 * Comprueba si un valor es un registro de modelo OpenCode válido.
 * @param {unknown} v Valor a validar.
 * @returns {v is RawOpencodeProviderModel} True si el valor representa un modelo OpenCode válido.
 */
function isModelRecord(v: unknown): v is RawOpencodeProviderModel {
  return (
    v !== null &&
    typeof v === 'object' &&
    typeof (v as { id?: unknown }).id === 'string' &&
    (v as { id: string }).id.trim().length > 0
  );
}

/**
 * Normaliza la salida de modelos del proveedor OpenCode para el catálogo.
 * @param {unknown} models Datos devueltos por config.providers().
 * @returns {RawOpencodeProviderModel[]} Array de registros de modelo válidos.
 */
export function normalizeOpencodeProviderModels(models: unknown): RawOpencodeProviderModel[] {
  if (models === null || models === undefined) {
    return [];
  }
  if (Array.isArray(models)) {
    return models.filter(isModelRecord);
  }
  if (typeof models === 'object') {
    const out: RawOpencodeProviderModel[] = [];
    for (const v of Object.values(models)) {
      if (isModelRecord(v)) {
        out.push(v);
      }
    }
    return out;
  }
  return [];
}
