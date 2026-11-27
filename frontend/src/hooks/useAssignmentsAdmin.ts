import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AssignableLesson,
  AssignmentCreate,
  AssignmentDetail,
  AssignmentSummary,
  AssignmentUpdate,
} from '@novel/shared';
import { api, del, patchJson, postJson } from '../services/api';

// Bắt đầu bằng 'admin' → tự xoá khi giáo viên đăng xuất.
const keys = {
  all: ['admin', 'assignments'] as const,
  one: (id: string) => ['admin', 'assignments', id] as const,
  lessons: ['admin', 'assignments', 'options', 'lessons'] as const,
};

export function useAssignments() {
  return useQuery({
    queryKey: keys.all,
    queryFn: () => api<AssignmentSummary[]>('/admin/assignments'),
  });
}

export function useAssignment(id: string) {
  return useQuery({
    queryKey: keys.one(id),
    queryFn: () => api<AssignmentDetail>(`/admin/assignments/${id}`),
    // Gần hạn giáo viên hay mở để theo dõi: tự làm mới mỗi phút.
    refetchInterval: 60_000,
  });
}

/** Unit + game giao được (Unit đã công khai, game đã gán cho Unit). */
export function useAssignableLessons() {
  return useQuery({
    queryKey: keys.lessons,
    queryFn: () =>
      api<AssignableLesson[]>('/admin/assignments/options/lessons'),
  });
}

export function useAssignmentMutations() {
  const qc = useQueryClient();
  const onSaved = (a: AssignmentDetail) => {
    qc.setQueryData(keys.one(a.id), a);
    void qc.invalidateQueries({ queryKey: keys.all, exact: true });
  };
  return {
    create: useMutation({
      mutationFn: (body: AssignmentCreate) =>
        postJson<AssignmentDetail>('/admin/assignments', body),
      onSuccess: onSaved,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: AssignmentUpdate & { id: string }) =>
        patchJson<AssignmentDetail>(`/admin/assignments/${id}`, body),
      onSuccess: onSaved,
    }),
    remove: useMutation({
      mutationFn: (id: string) => del(`/admin/assignments/${id}`),
      onSuccess: (_v, id) => {
        qc.removeQueries({ queryKey: keys.one(id) });
        void qc.invalidateQueries({ queryKey: keys.all, exact: true });
      },
    }),
  };
}
