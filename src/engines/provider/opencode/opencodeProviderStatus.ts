/**
 * @file Adaptador ProviderStatusModule para OpenCode (delega en opencodeServerManager).
 */
import {
  pingOpenCodeServer,
  startOpenCodeServer,
  stopOpenCodeServer,
} from './server/opencodeServerManager';

import type { ProviderStateRecord, ProviderStatusModule } from '../../../system/internals/protocols/state/provider';

export const opencodeStatusModule: ProviderStatusModule = {
  id: 'opencode',
  label: 'OpenCode',

  async check(): Promise<ProviderStateRecord> {
    const alive = await pingOpenCodeServer();

    if (alive) {
      return {
        id: 'opencode',
        status: 'running',
        label: 'OpenCode',
        statusText: 'Servidor activo',
        actions: ['stop'],
      };
    }

    return {
      id: 'opencode',
      status: 'stopped',
      label: 'OpenCode',
      statusText: 'Servidor detenido',
      actions: ['start'],
    };
  },

  start(): Promise<void> {
    return startOpenCodeServer();
  },

  stop(): Promise<void> {
    return stopOpenCodeServer();
  },
};
