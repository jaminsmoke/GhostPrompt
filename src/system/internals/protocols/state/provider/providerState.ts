/**
 * @file Contrato de estado de salud de un proveedor LM (mensaje providerStatus).
 */
import type { ProviderId } from './providerId';

export type ProviderState =
  | 'running'
  | 'stopped'
  | 'starting'
  | 'unavailable'
  | 'error';

export interface ProviderStateRecord {
  id: ProviderId;
  status: ProviderState;
  label: string;
  statusText?: string;
  actions?: ('start' | 'stop')[];
}
