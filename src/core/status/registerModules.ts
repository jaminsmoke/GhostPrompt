import { providerStatusManager } from './ProviderStatusManager';
import { copilotStatusModule } from '../../engines/copilot/copilotStatus';
import { opencodeStatusModule } from '../../engines/opencode/opencodeStatus';
import { ollamaStatusModule } from '../../engines/ollama/ollamaStatus';
import { copilotChatStatusModule } from '../../destinations/copilotChat/copilotChatStatus';
import { vsOpenCodeXStatusModule } from '../../destinations/vsOpenCodeX/vsOpenCodeXStatus';

/**
 * Registra todos los módulos de estado de proveedores disponibles.
 * Esto permite que el panel de status muestre el estado de engines y destinos.
 */
export function registerAllProviderModules(): void {
  // Engines
  providerStatusManager.register(copilotStatusModule);
  providerStatusManager.register(opencodeStatusModule);
  providerStatusManager.register(ollamaStatusModule);

  // Destinations
  providerStatusManager.register(copilotChatStatusModule);
  providerStatusManager.register(vsOpenCodeXStatusModule);
}
