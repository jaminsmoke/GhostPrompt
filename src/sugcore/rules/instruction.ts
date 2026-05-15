/**
 * Construye la instrucción para el modelo a partir del texto del usuario.
 * Instrucción mínima: el modelo infiere idioma, estilo y espaciado por contexto.
 * @param {string} userText Texto que se debe continuar.
 * @returns {string} Prompt completo listo para enviar al modelo.
 */
export function buildCompletionInstruction(userText: string): string {
  return [
    'Complete the following text as a natural continuation, not like a response to the user.',
    'Only output the continuation itself, no commentary or repetition.',
    '',
    userText,
  ].join('\n');
}
