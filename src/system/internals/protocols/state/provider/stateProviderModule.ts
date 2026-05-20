/**
 * @file Puerto de comprobación e inicio/parada de un proveedor LM.
 */
import type { ProviderId } from './stateProviderId';
import type { ProviderStateRecord } from './stateProviderRecord';

export interface ProviderStatusModule {
  id: ProviderId;
  label: string;
  check: () => Promise<ProviderStateRecord>;
  start?: () => Promise<void>;
  stop?: () => Promise<void>;
}
