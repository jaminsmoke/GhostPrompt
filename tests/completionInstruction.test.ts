import { describe, expect, it } from 'vitest';

import {
  COMPLETION_PARTIAL_LABEL,
  buildCompletionInstruction,
} from '../src/core/prompt/instruction';

describe('buildCompletionInstruction', () => {
  it('concatena directivas de estilo + partial etiquetado (prompt compacto)', () => {
    const text = buildCompletionInstruction('hola', 'balanced');
    expect(text).toContain('STYLE_BALANCED:');
    expect(text).toContain(`${COMPLETION_PARTIAL_LABEL}hola`);
    expect(text.endsWith(`${COMPLETION_PARTIAL_LABEL}hola`)).toBe(true);
  });

  it('ignora el contexto opcional (sin bloque de proyecto en el prompt)', () => {
    const text = buildCompletionInstruction('hola', 'balanced', {
      outputLanguage: 'en',
      workspaceName: 'demo',
      projectBootstrapLines: [
        'README excerpt (README.md): resumen corto',
        'package.json: name=demo',
      ],
    });
    expect(text).not.toContain('Relevant project context:');
    expect(text).not.toContain('Workspace: demo');
    expect(text).toContain(`${COMPLETION_PARTIAL_LABEL}hola`);
  });
});
