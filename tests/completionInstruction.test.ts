import { describe, expect, it } from 'vitest';

import {
  COMPLETION_PARTIAL_LABEL,
  buildCompletionInstruction,
  buildCompletionInstructionParts,
} from '../src/core/instruction';

describe('buildCompletionInstruction', () => {
  it('prefix + labeledPartial coincide con la instrucción completa (contrato Copilot 2× User)', () => {
    const ctx = {
      outputLanguage: 'en' as const,
      workspaceName: 'demo',
      projectBootstrapLines: ['README: x'],
    };
    const full = buildCompletionInstruction('hola', 'balanced', ctx);
    const parts = buildCompletionInstructionParts('hola', 'balanced', ctx);
    expect(parts.prefixInstruction + parts.labeledPartial).toBe(full);
    expect(parts.labeledPartial).toBe(`${COMPLETION_PARTIAL_LABEL}hola`);
  });

  it('incluye projectBootstrapLines en Relevant project context', () => {
    const text = buildCompletionInstruction('hola', 'balanced', {
      outputLanguage: 'en',
      workspaceName: 'demo',
      projectBootstrapLines: [
        'README excerpt (README.md): resumen corto',
        'package.json: name=demo',
      ],
    });
    expect(text).toContain('Relevant project context:');
    expect(text).toContain('Workspace: demo');
    expect(text).toContain('README excerpt (README.md): resumen corto');
    expect(text).toContain('package.json: name=demo');
    expect(text).toContain('Partial text to continue: hola');
  });
});
