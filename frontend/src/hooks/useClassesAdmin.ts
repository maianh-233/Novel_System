import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import type {
  AssignClassRequest,
  ClassCreate,
  ClassGroupAdmin,
  ClassUpdate,
} from '@novel/shared';
import { api, del, patchJson, postJson } from '../services/api';

// Bắt đầu bằng 'admin' → tự xoá khi giáo viên đăng xuất.
const CLASSES_KEY = ['admin', 'classes'] as const;
const STUDENTS_KEY = ['admin', 'students'] as const;

export function useClasses() {
  return useQuery({
    queryKey: CLASSES_KEY,
    queryFn: () => api<ClassGroupAdmin[]>('/admin/classes'),
  });
}

export function useClassMutations() {
  const qc = useQueryClient();
  // Đổi lớp thì danh sách học sinh (cột Lớp) cũng đổi.
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: CLASSES_KEY });
    void qc.invalidateQueries({ queryKey: STUDENTS_KEY });
  };
  return {
    create: useMutation({
      mutationFn: (body: ClassCreate) =>
        postJson<ClassGroupAdmin>('/admin/classes', body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: ClassUpdate & { id: string }) =>
        patchJson<ClassGroupAdmin>(`/admin/classes/${id}`, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => del(`/admin/classes/${id}`),
      onSuccess: invalidate,
    }),
    assign: useMutation({
      mutationFn: (body: AssignClassRequest) =>
        postJson<{ updated: number }>('/admin/students/assign-class', body),
      onSuccess: invalidate,
    }),
  };
}
