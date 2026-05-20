/**
 * @file Registro de módulos de estado de proveedores LM en el manager del host.
 */
import { providerStatusManager } from '../../system/runtime/providers/providerStatusManager';
import { copilotStatusModule } from '../provider/copilot/host/copilotHostStatusModule';
import { ollamaStatusModule } from '../provider/ollama/host/ollamaHostStatusModule';
import { opencodeStatusModule } from '../provider/opencode/server/opencodeServerStatusModule';

/**
 * Registra los módulos de estado de copilot, opencode y ollama.
 */
export function registerProviderStatusRegistry(): void {
  providerStatusManager.register(copilotStatusModule);
  providerStatusManager.register(opencodeStatusModule);
  providerStatusManager.register(ollamaStatusModule);
}
