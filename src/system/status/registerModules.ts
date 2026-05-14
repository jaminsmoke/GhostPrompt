import { providerStatusManager } from "./ProviderStatusManager";
import { copilotStatusModule } from "../../engines/copilot/copilotStatus";
import { opencodeStatusModule } from "../../engines/opencode/opencodeStatus";
import { ollamaStatusModule } from "../../engines/ollama/ollamaStatus";
import { copilotChatStatusModule } from "../../destinations/copilotChat/copilotChatStatus";
import { vsOpenCodeXStatusModule } from "../../destinations/vsOpenCodeX/vsOpenCodeXStatus";

export function registerAllProviderModules(): void {
  // Engines
  providerStatusManager.register(copilotStatusModule);
  providerStatusManager.register(opencodeStatusModule);
  providerStatusManager.register(ollamaStatusModule);

  // Destinations
  providerStatusManager.register(copilotChatStatusModule);
  providerStatusManager.register(vsOpenCodeXStatusModule);
}
