import { QueryClient } from '@tanstack/react-query';

const ONE_DAY_IN_MS = 1000 * 60 * 60 * 24;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: ONE_DAY_IN_MS,
      gcTime: ONE_DAY_IN_MS,
      
      networkMode: 'offlineFirst', 

      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});