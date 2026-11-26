import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  StudentAdmin,
  StudentCredentials,
  StudentDetail,
  StudentUpdate,
} from '@novel/shared';
import { api, del, patchJson, postJson } from '../services/api';

// Bắt đầu bằng 'admin' → tự xoá khi giáo viên đăng xuất.
const keys = {
  all: ['admin', 'students'] as const,
  one: (id: string) => ['admin', 'students', id] as const,
};

export function useStudents() {
  return useQuery({
    queryKey: keys.all,
    queryFn: () => api<StudentAdmin[]>('/admin/students'),
  });
}

export function useStudent(id: string) {
  return useQuery({
    queryKey: keys.one(id),
    queryFn: () => api<StudentDetail>(`/admin/students/${id}`),
  });
}

export function useStudentMutations() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: keys.all });
  return {
    create: useMutation({
      mutationFn: (body: { names: string[]; classId: string | null }) =>
        postJson<StudentCredentials[]>('/admin/students', body),
      onSuccess: () => {
        invalidate();
        void qc.invalidateQueries({ queryKey: ['admin', 'classes'] });
      },
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: StudentUpdate & { id: string }) =>
        patchJson<StudentAdmin>(`/admin/students/${id}`, body),
      onSuccess: invalidate,
    }),
    resetPassword: useMutation({
      mutationFn: (id: string) =>
        postJson<StudentCredentials>(`/admin/students/${id}/reset-password`),
    }),
    remove: useMutation({
      mutationFn: (id: string) => del(`/admin/students/${id}`),
      onSuccess: invalidate,
    }),
  };
}
