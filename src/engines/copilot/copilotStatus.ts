import type { ProviderStatusModule, ProviderStateRecord } from '../../system/status/types';

export const copilotStatusModule: ProviderStatusModule = {
  id: 'copilot',
  kind: 'engine',
  label: 'Copilot LM',

  async check(): Promise<ProviderStateRecord> {
    return {
      id: 'copilot',
      kind: 'engine',
      status: 'running',
      label: 'Copilot LM',
      statusText: 'Siempre disponible',
    };
  },
};
