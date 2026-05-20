/**
 * @file Contrato de estado de salud de un proveedor LM (mensaje providerStatus).
 */
import type { ProviderId } from './stateProviderId';

export type ProviderState =
  'error' | 'running' | 'starting' | 'stopped' | 'unavailable';

export interface ProviderStateRecord {
  id: ProviderId;
  status: ProviderState;
  label: string;
  statusText?: string;
  actions?: ('start' | 'stop')[];
}
