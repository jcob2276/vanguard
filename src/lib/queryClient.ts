import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30s default to align with goalSpine cache TTL
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
