/**
 * @file Instrucción de completado enviada al modelo de sugerencias (compartida por motores).
 */
import { DEFAULT_MAX_SUGGESTION_CHARS } from '../../system/internals/protocols/constants/consPipelineDefaults';
import { instructionHintForMaxChars } from '../../system/internals/protocols/suggestionLength/suggestionLength';

export interface BuildCompletionInstructionOptions {
  maxChars?: number;
}

/**
 * Construye la instrucción para el modelo a partir del texto del usuario.
 * @param {string} userText - Texto que se debe continuar.
 * @param {BuildCompletionInstructionOptions} [options] - Tope de caracteres de la pre-suggestion.
 * @returns {string} Prompt completo listo para enviar al modelo.
 */
export function buildCompletionInstruction(
  userText: string,
  options?: BuildCompletionInstructionOptions,
): string {
  const maxChars = options?.maxChars ?? DEFAULT_MAX_SUGGESTION_CHARS;
  return [
    'Complete the following text as a natural continuation, not like a response to the user.',
    'Only output the continuation itself, no commentary or repetition.',
    instructionHintForMaxChars(maxChars),
    '',
    userText,
  ].join('\n');
}
