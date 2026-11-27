import { useQuery } from '@tanstack/react-query';
import type { PlayAssignment } from '@novel/shared';
import { api } from '../services/api';

// Bắt đầu bằng 'student' → tự xoá khi học sinh đăng xuất.
export const ASSIGNMENTS_KEY = ['student', 'assignments'] as const;

export function usePlayAssignments(enabled = true) {
  return useQuery({
    queryKey: ASSIGNMENTS_KEY,
    queryFn: () => api<PlayAssignment[]>('/play/assignments'),
    enabled,
  });
}
