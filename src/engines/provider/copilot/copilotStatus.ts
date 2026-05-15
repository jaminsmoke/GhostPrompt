/**
 * @file Estado de la fuente de completado Copilot LM.
 */
import type { ProviderStateRecord, ProviderStatusModule } from '../../../system/internals/protocols/state/provider';

export const copilotStatusModule: ProviderStatusModule = {
  id: 'copilot',
  label: 'Copilot LM',

  check(): Promise<ProviderStateRecord> {
    return Promise.resolve({
      id: 'copilot',
      status: 'running',
      label: 'Copilot LM',
      statusText: 'Siempre disponible',
    });
  },
};
