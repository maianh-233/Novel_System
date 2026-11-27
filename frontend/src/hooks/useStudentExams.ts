import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AttemptResponse,
  PlayExam,
  SaveAnswerRequest,
} from '@novel/shared';
import { api, postJson, putJson } from '../services/api';
import { ASSIGNMENTS_KEY } from './useStudentAssignments';

// Mọi key bắt đầu bằng 'student' → tự xoá khi học sinh đăng xuất.
const keys = {
  exams: ['student', 'exams'] as const,
  attempt: (id: string) => ['student', 'attempt', id] as const,
};

export function usePlayExams(enabled = true) {
  return useQuery({
    queryKey: keys.exams,
    queryFn: () => api<PlayExam[]>('/play/exams'),
    enabled,
  });
}

export function useAttempt(id: string) {
  return useQuery({
    queryKey: keys.attempt(id),
    queryFn: () => api<AttemptResponse>(`/play/attempts/${id}`),
    // Bài đang làm không tự tải lại (sẽ đè câu em đang gõ); chỉ tải khi vào trang.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useStartAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (examId: string) =>
      postJson<AttemptResponse>(`/play/exams/${examId}/attempts`),
    onSuccess: (r) => {
      const id = r.status === 'in_progress' ? r.attempt.id : r.result.id;
      qc.setQueryData(keys.attempt(id), r);
      void qc.invalidateQueries({ queryKey: keys.exams });
    },
  });
}

export const saveAnswer = (
  attemptId: string,
  itemId: string,
  body: SaveAnswerRequest,
) =>
  putJson<{ savedAt: string }>(
    `/play/attempts/${attemptId}/answers/${itemId}`,
    body,
  );

export function useSubmitAttempt(attemptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      postJson<AttemptResponse>(`/play/attempts/${attemptId}/submit`),
    onSuccess: (r) => {
      qc.setQueryData(keys.attempt(attemptId), r);
      void qc.invalidateQueries({ queryKey: keys.exams });
      void qc.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
    },
  });
}

/** Tải lại bài từ máy chủ (vd: máy chủ báo đã hết giờ → nhận kết quả). */
export function useReloadAttempt(attemptId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: keys.attempt(attemptId) });
}
