/**
 * @file Consultas React Query del webview GhostPrompt.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { WEBVIEW_PROVIDER_STATUS_STALE_MS } from '../../../../system/internals/protocols/constants/consPipelineDefaults';
import { hostQuery } from '../utils/hostQuery';

import { postToHost } from './ghostPromptPostMessage';

import type { CompletionSourceStateRecord } from '../types';

/**
 * Consultas React Query de estado de proveedores en el webview.
 * @returns {object} Cliente de query y mutaciones start/stop.
 */
export function useGhostPromptProviderQueries() {
  const queryClient = useQueryClient();

  const { data: providerStatuses = [], isLoading: statusLoading } = useQuery({
    queryKey: ['providerStatus'],
    queryFn: () =>
      hostQuery<{ providers: CompletionSourceStateRecord[] }>(
        { type: 'requestProviderStatus' },
        'providerStatus',
        postToHost,
      ).then((response) => response.providers),
    staleTime: WEBVIEW_PROVIDER_STATUS_STALE_MS,
  });

  const { mutate: mutateStartProvider } = useMutation({
    mutationFn: (provider: string) =>
      hostQuery<{ providers: CompletionSourceStateRecord[] }>(
        { type: 'startProvider', provider },
        'providerStatus',
        postToHost,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providerStatus'] }).catch(() => {
        /* Ignore */
      });
    },
  });

  const { mutate: mutateStopProvider } = useMutation({
    mutationFn: (provider: string) =>
      hostQuery<{ providers: CompletionSourceStateRecord[] }>(
        { type: 'stopProvider', provider },
        'providerStatus',
        postToHost,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providerStatus'] }).catch(() => {
        /* Ignore */
      });
    },
  });

  return {
    queryClient,
    providerStatuses,
    statusLoading,
    mutateStartProvider,
    mutateStopProvider,
  };
}
