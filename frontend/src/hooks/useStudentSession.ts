import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { UNASSIGNED_LEARNER, type Learner } from '@novel/shared';
import type {
  FinishSessionRequest,
  FinishSessionResponse,
  PlayGameInfo,
  PlaySessionSummary,
  StartSessionRequest,
  StartSessionResponse,
  StudentLoginRequest,
  StudentProfile,
} from '@novel/shared';
import { api, ApiError, postJson } from '../services/api';
import { ASSIGNMENTS_KEY } from './useStudentAssignments';

// Mọi key bắt đầu bằng 'student' → tự xoá khi học sinh đăng xuất.
export const STUDENT_ME_KEY = ['student', 'me'] as const;
const HISTORY_KEY = ['student', 'history'] as const;

/**
 * Xoá dữ liệu của học sinh trước (máy dùng chung). Giữ lại query `me` — header đang theo dõi nó,
 * xoá đi thì header không nhận được giá trị mới ghi vào sau đó.
 */
function clearStudentData(qc: QueryClient) {
  qc.removeQueries({
    queryKey: ['student'],
    predicate: (q) => q.queryKey[1] !== STUDENT_ME_KEY[1],
  });
}

/** Học sinh đang đăng nhập; `null` = chưa đăng nhập. */
export function useStudentMe() {
  return useQuery({
    queryKey: STUDENT_ME_KEY,
    queryFn: async (): Promise<StudentProfile | null> => {
      try {
        return await api<StudentProfile>('/play/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}

/** Cấp học + khối của em đang đăng nhập; chưa đăng nhập hoặc chưa xếp lớp = tiểu học. */
export function useLearner(): Learner {
  const { data: me } = useStudentMe();
  return me ? { stage: me.stage, grade: me.grade } : UNASSIGNED_LEARNER;
}

export function useStudentLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StudentLoginRequest) =>
      postJson<StudentProfile>('/play/auth/login', body),
    onSuccess: (profile) => {
      // Máy dùng chung: xoá dữ liệu của bạn đăng nhập trước.
      clearStudentData(qc);
      qc.setQueryData(STUDENT_ME_KEY, profile);
    },
  });
}

export function useStudentLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<void>('/play/auth/logout'),
    onSettled: () => {
      clearStudentData(qc);
      qc.setQueryData(STUDENT_ME_KEY, null);
    },
  });
}

export function usePlayGame(slug: string) {
  return useQuery({
    queryKey: ['student', 'game', slug],
    queryFn: () => api<PlayGameInfo>(`/play/games/${slug}`),
  });
}

export function useStartSession() {
  return useMutation({
    mutationFn: (body: StartSessionRequest) =>
      postJson<StartSessionResponse>('/play/sessions', body),
  });
}

export function useFinishSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      ...body
    }: FinishSessionRequest & { sessionId: string }) =>
      postJson<FinishSessionResponse>(
        `/play/sessions/${sessionId}/finish`,
        body,
      ),
    onSuccess: (result) => {
      qc.setQueryData<StudentProfile | null>(STUDENT_ME_KEY, (me) =>
        me ? { ...me, totalStars: result.totalStars } : me,
      );
      void qc.invalidateQueries({ queryKey: HISTORY_KEY });
      // Lượt chơi có thể làm xong một bài tập về nhà.
      void qc.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
    },
  });
}

export function usePlayHistory() {
  return useQuery({
    queryKey: HISTORY_KEY,
    queryFn: () => api<PlaySessionSummary[]>('/play/sessions'),
  });
}
