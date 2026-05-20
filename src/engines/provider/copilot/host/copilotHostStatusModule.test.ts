/**
 * @file Pruebas del módulo de estado host Copilot LM.
 */

import * as vitest from 'vitest';

import { copilotStatusModule } from './copilotHostStatusModule';

vitest.describe('copilotStatusModule', () => {
  vitest.it('retorna siempre running', async () => {
    const state = await copilotStatusModule.check();
    vitest.expect(state.status).toBe('running');
    vitest.expect(state.label).toBe('Copilot LM');
    vitest.expect(state.id).toBe('copilot');
  });
});
