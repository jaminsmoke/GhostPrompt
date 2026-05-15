/**
 * @file Puerto de comprobación e inicio/parada de un proveedor LM.
 */
import type { ProviderId } from './providerId';
import type { ProviderStateRecord } from './providerState';

export interface ProviderStatusModule {
  id: ProviderId;
  label: string;
  check(): Promise<ProviderStateRecord>;
  start?(): Promise<void>;
  stop?(): Promise<void>;
}
