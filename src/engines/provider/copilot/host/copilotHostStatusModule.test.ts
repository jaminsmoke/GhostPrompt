/**
 * @file Pruebas del módulo de estado host Copilot LM.
 */
import { describe, expect, it } from 'vitest';

import { copilotStatusModule } from './copilotHostStatusModule';

describe('copilotStatusModule', () => {
  it('retorna siempre running', async () => {
    const state = await copilotStatusModule.check();
    expect(state.status).toBe('running');
    expect(state.label).toBe('Copilot LM');
    expect(state.id).toBe('copilot');
  });
});
