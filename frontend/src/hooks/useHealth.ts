import { useQuery } from '@tanstack/react-query';
import type { HealthStatus } from '@novel/shared';
import { api } from '../services/api';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api<HealthStatus>('/health'),
    refetchInterval: 30_000,
    retry: false,
  });
}
