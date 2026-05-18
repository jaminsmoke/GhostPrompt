/**
 * @file Pruebas de arranque del canal GhostPrompt Log.
 */
import * as vitest from 'vitest';

import { GHOSTPROMPT_LOG_CHANNEL_NAME } from '../internals/protocols/constants/consLogLimits';

vitest.describe('hostFault', () => {
  vitest.it('expone el nombre canónico del canal de salida', () => {
    vitest.expect(GHOSTPROMPT_LOG_CHANNEL_NAME).toBe('GhostPrompt Log');
  });
});
