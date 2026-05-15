/**
 * @file Registro de módulos de estado de fuentes de completado.
 */
import { copilotStatusModule } from '../copilot/copilotStatus';
import { ollamaStatusModule } from '../ollama/ollamaStatus';
import { opencodeStatusModule } from '../opencode/opencodeStatus';

import { completionSourceStatusManager } from './completionSourceStatusManager';

/**
 * Registra los módulos de estado de las fuentes de completado del motor de sugerencias.
 */
export function registerCompletionSourceStatusModules(): void {
  completionSourceStatusManager.register(copilotStatusModule);
  completionSourceStatusManager.register(opencodeStatusModule);
  completionSourceStatusManager.register(ollamaStatusModule);
}
