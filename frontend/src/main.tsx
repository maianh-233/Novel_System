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
import { STUDENT_ME_KEY } from './hooks/useStudentSession';
import './index.css';
import { router } from './router';
import { ApiError } from './services/api';

/**
 * Phiên đăng nhập hết hạn giữa chừng (API trả 401) → đánh dấu chưa đăng nhập.
 * RequireAdmin / RequireStudent sẽ đưa về trang đăng nhập rồi quay lại đúng trang đang mở.
 * Giáo viên và học sinh có phiên riêng, phân biệt theo khu API.
 */
function onApiError(error: unknown) {
  if (
    !(error instanceof ApiError) ||
    error.status !== 401 ||
    error.code !== 'not_authenticated'
  )
    return;
  if (error.path?.startsWith('/admin')) {
    queryClient.setQueryData(ADMIN_ME_KEY, null);
  } else if (error.path?.startsWith('/play')) {
    queryClient.setQueryData(STUDENT_ME_KEY, null);
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
