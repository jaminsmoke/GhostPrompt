/**
 * @file Registro de módulos de estado de proveedores LM en el manager del host.
 */
import { providerStatusManager } from '../../system/runtime/providerStatusManager';
import { copilotStatusModule } from '../provider/copilot/copilotStatus';
import { ollamaStatusModule } from '../provider/ollama/ollamaStatus';
import { opencodeStatusModule } from '../provider/opencode/opencodeProviderStatus';

/**
 * Registra los módulos de estado de copilot, opencode y ollama.
 */
export function registerProviderStatusRegistry(): void {
  providerStatusManager.register(copilotStatusModule);
  providerStatusManager.register(opencodeStatusModule);
  providerStatusManager.register(ollamaStatusModule);
}
