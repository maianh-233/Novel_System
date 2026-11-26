import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminLoginRequest,
  AdminProfile,
  ChangePasswordRequest,
} from '@novel/shared';
import { api, ApiError, postJson } from '../services/api';

export const ADMIN_ME_KEY = ['admin', 'me'] as const;

/** Giáo viên đang đăng nhập; `null` = chưa đăng nhập. */
export function useAdminMe() {
  return useQuery({
    queryKey: ADMIN_ME_KEY,
    queryFn: async (): Promise<AdminProfile | null> => {
      try {
        return await api<AdminProfile>('/admin/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function useAdminLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminLoginRequest) =>
      postJson<AdminProfile>('/admin/auth/login', body),
    onSuccess: (profile) => qc.setQueryData(ADMIN_ME_KEY, profile),
  });
}

export function useAdminLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<void>('/admin/auth/logout'),
    onSettled: () => {
      // Xoá mọi dữ liệu quản trị đã cache để không còn hiển thị sau khi đăng xuất.
      qc.removeQueries({ queryKey: ['admin'] });
      qc.setQueryData(ADMIN_ME_KEY, null);
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) =>
      postJson<void>('/admin/auth/change-password', body),
  });
}
