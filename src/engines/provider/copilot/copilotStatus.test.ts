/**
 * @file Pruebas de estado de la fuente Copilot LM.
 */
import { describe, expect, it } from 'vitest';

import { copilotStatusModule } from './copilotStatus';

describe('copilotStatusModule', () => {
  it('retorna siempre running', async () => {
    const state = await copilotStatusModule.check();
    expect(state.status).toBe('running');
    expect(state.label).toBe('Copilot LM');
    expect(state.id).toBe('copilot');
  });
});
