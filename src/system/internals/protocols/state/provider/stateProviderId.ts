/**
 * @file Identificadores de proveedores LM (copilot, opencode, ollama).
 */
export const PROVIDER_ID_VALUES = ['copilot', 'opencode', 'ollama'] as const;

export type ProviderId = (typeof PROVIDER_ID_VALUES)[number];
