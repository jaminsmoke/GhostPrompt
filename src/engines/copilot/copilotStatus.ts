/**
 * @file Estado de la fuente de completado Copilot LM.
 */
import type {
  CompletionSourceStateRecord,
  CompletionSourceStatusModule,
} from '../status/completionSourceStatusTypes';

export const copilotStatusModule: CompletionSourceStatusModule = {
  id: 'copilot',
  label: 'Copilot LM',

  check(): Promise<CompletionSourceStateRecord> {
    return Promise.resolve({
      id: 'copilot',
      status: 'running',
      label: 'Copilot LM',
      statusText: 'Siempre disponible',
    });
  },
};
