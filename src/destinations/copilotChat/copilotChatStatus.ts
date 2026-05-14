import type { ProviderStatusModule, ProviderStateRecord } from '../../system/status/types';

export const copilotChatStatusModule: ProviderStatusModule = {
  id: 'copilotChat',
  kind: 'destination',
  label: 'Copilot Chat',

  async check(): Promise<ProviderStateRecord> {
    return {
      id: 'copilotChat',
      kind: 'destination',
      status: 'running',
      label: 'Copilot Chat',
      statusText: 'Siempre disponible',
    };
  },
};
