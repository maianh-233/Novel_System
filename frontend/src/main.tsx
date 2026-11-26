import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ADMIN_ME_KEY } from './hooks/useAdminSession';
import './index.css';
import { router } from './router';
import { ApiError } from './services/api';

/**
 * Phiên đăng nhập hết hạn giữa chừng (API admin trả 401) → đánh dấu chưa đăng nhập,
 * RequireAdmin sẽ đưa giáo viên về trang đăng nhập và quay lại đúng trang đang mở.
 */
function onApiError(error: unknown) {
  if (
    error instanceof ApiError &&
    error.status === 401 &&
    error.code === 'not_authenticated'
  ) {
    queryClient.setQueryData(ADMIN_ME_KEY, null);
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: { queries: { staleTime: 30_000 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
