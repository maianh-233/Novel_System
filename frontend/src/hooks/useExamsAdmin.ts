import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ExamCreate,
  ExamDetail,
  ExamResults,
  ExamStructure,
  ExamSummary,
  ExamUpdate,
} from '@novel/shared';
import { api, del, patchJson, postJson, putJson } from '../services/api';

// Bắt đầu bằng 'admin' → tự xoá khi giáo viên đăng xuất.
const keys = {
  all: ['admin', 'exams'] as const,
  one: (id: string) => ['admin', 'exams', id] as const,
  results: (id: string) => ['admin', 'exams', id, 'results'] as const,
};

export function useExams() {
  return useQuery({
    queryKey: keys.all,
    queryFn: () => api<ExamSummary[]>('/admin/exams'),
  });
}

export function useExam(id: string) {
  return useQuery({
    queryKey: keys.one(id),
    queryFn: () => api<ExamDetail>(`/admin/exams/${id}`),
  });
}

export function useExamResults(id: string) {
  return useQuery({
    queryKey: keys.results(id),
    queryFn: () => api<ExamResults>(`/admin/exams/${id}/results`),
    // Trong giờ thi giáo viên hay mở bảng điểm theo dõi: tự làm mới mỗi 30 giây.
    refetchInterval: 30_000,
  });
}

export function useExamMutations() {
  const qc = useQueryClient();
  const onExam = (e: ExamDetail) => {
    qc.setQueryData(keys.one(e.id), e);
    void qc.invalidateQueries({ queryKey: keys.all, exact: true });
  };
  return {
    create: useMutation({
      mutationFn: (body: ExamCreate) =>
        postJson<ExamDetail>('/admin/exams', body),
      onSuccess: onExam,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: ExamUpdate & { id: string }) =>
        patchJson<ExamDetail>(`/admin/exams/${id}`, body),
      onSuccess: onExam,
    }),
    setStructure: useMutation({
      mutationFn: ({ id, ...body }: ExamStructure & { id: string }) =>
        putJson<ExamDetail>(`/admin/exams/${id}/structure`, body),
      onSuccess: onExam,
    }),
    duplicate: useMutation({
      mutationFn: (id: string) =>
        postJson<ExamDetail>(`/admin/exams/${id}/duplicate`),
      onSuccess: onExam,
    }),
    remove: useMutation({
      mutationFn: (id: string) => del(`/admin/exams/${id}`),
      onSuccess: (_v, id) => {
        qc.removeQueries({ queryKey: keys.one(id) });
        void qc.invalidateQueries({ queryKey: keys.all });
      },
    }),
  };
}
