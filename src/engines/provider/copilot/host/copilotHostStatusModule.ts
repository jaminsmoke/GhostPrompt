/**
 * @file Host I/O Copilot LM: estado fijo como `ProviderStatusModule` (Copilot viene del IDE).
 */
import type { ProviderStateRecord, ProviderStatusModule } from '../../../../system/internals/protocols/state/provider';

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
