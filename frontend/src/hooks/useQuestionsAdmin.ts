import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  Paginated,
  PassageAdmin,
  PassageInput,
  QuestionAdmin,
  QuestionImportRequest,
  QuestionImportResult,
  QuestionInput,
  QuestionQuery,
  QuestionStatus,
} from '@novel/shared';
import { api, del, patchJson, postJson, putJson } from '../services/api';
import { toSearch } from './useContentAdmin';

// Bắt đầu bằng 'admin' → tự xoá khi giáo viên đăng xuất.
const keys = {
  questions: ['admin', 'questions'] as const,
  list: (q: QuestionQuery) => ['admin', 'questions', 'list', q] as const,
  tags: ['admin', 'questions', 'tags'] as const,
  passages: ['admin', 'passages'] as const,
  // Unit hiện số câu hỏi; sửa câu hỏi thì làm mới cả bài học.
  lessons: ['admin', 'lessons'] as const,
};

export function useQuestionList(q: QuestionQuery, enabled = true) {
  return useQuery({
    queryKey: keys.list(q),
    queryFn: () =>
      api<Paginated<QuestionAdmin>>(`/admin/questions${toSearch(q)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useQuestionTags() {
  return useQuery({
    queryKey: keys.tags,
    queryFn: () => api<string[]>('/admin/questions/tags'),
    staleTime: 60_000,
  });
}

export function usePassages() {
  return useQuery({
    queryKey: keys.passages,
    queryFn: () => api<PassageAdmin[]>('/admin/passages'),
  });
}

export function useQuestionMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.questions });
    void qc.invalidateQueries({ queryKey: keys.passages });
    void qc.invalidateQueries({ queryKey: keys.lessons });
  };
  return {
    create: useMutation({
      mutationFn: (body: QuestionInput) =>
        postJson<QuestionAdmin>('/admin/questions', body),
      onSuccess: invalidate,
    }),
    replace: useMutation({
      mutationFn: ({ id, ...body }: QuestionInput & { id: string }) =>
        putJson<QuestionAdmin>(`/admin/questions/${id}`, body),
      onSuccess: invalidate,
    }),
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: QuestionStatus }) =>
        patchJson<QuestionAdmin>(`/admin/questions/${id}/status`, { status }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => del(`/admin/questions/${id}`),
      onSuccess: invalidate,
    }),
    importQuestions: useMutation({
      mutationFn: (body: QuestionImportRequest) =>
        postJson<QuestionImportResult>('/admin/questions/import', body),
      onSuccess: (r) => {
        if (!r.dryRun) invalidate();
      },
    }),
  };
}

export function usePassageMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.passages });
    void qc.invalidateQueries({ queryKey: keys.questions });
  };
  return {
    create: useMutation({
      mutationFn: (body: PassageInput) =>
        postJson<PassageAdmin>('/admin/passages', body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: PassageInput & { id: string }) =>
        putJson<PassageAdmin>(`/admin/passages/${id}`, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => del(`/admin/passages/${id}`),
      onSuccess: invalidate,
    }),
  };
}
