import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  CategoryAdmin,
  CategoryCreate,
  CategoryUpdate,
  DictionaryLookupResult,
  GameAdmin,
  ImageImportRequest,
  ImageSearchQuery,
  ImageSearchResponse,
  GameUpdate,
  LessonDetail,
  LessonGamePreview,
  LessonInput,
  LessonSummary,
  LessonUpdate,
  Paginated,
  PublicCategory,
  VocabularyAdmin,
  VocabularyImportRequest,
  VocabularyImportResult,
  VocabularyInput,
  VocabularyQuery,
  VocabularyUpdate,
} from '@novel/shared';
import {
  api,
  del,
  patchJson,
  postJson,
  putJson,
  uploadFile,
} from '../services/api';

// Mọi key bắt đầu bằng 'admin' → tự xoá khi đăng xuất (xem useAdminLogout).
export const keys = {
  categories: ['admin', 'categories'] as const,
  vocabulary: ['admin', 'vocabulary'] as const,
  vocabularyList: (q: VocabularyQuery) =>
    ['admin', 'vocabulary', 'list', q] as const,
  lessons: ['admin', 'lessons'] as const,
  lesson: (id: string) => ['admin', 'lessons', id] as const,
  lessonPreview: (id: string) => ['admin', 'lessons', id, 'preview'] as const,
  games: ['admin', 'games'] as const,
};

export function toSearch(q: object): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

// ───────────── Chủ đề ─────────────

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api<CategoryAdmin[]>('/admin/categories'),
  });
}

export function useCategoryMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.categories });
    void qc.invalidateQueries({ queryKey: keys.vocabulary });
  };
  return {
    create: useMutation({
      mutationFn: (body: CategoryCreate) =>
        postJson<CategoryAdmin>('/admin/categories', body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: CategoryUpdate & { id: string }) =>
        patchJson<CategoryAdmin>(`/admin/categories/${id}`, body),
      onSuccess: invalidate,
    }),
    reorder: useMutation({
      mutationFn: (ids: string[]) =>
        putJson<void>('/admin/categories/order', { ids }),
      // Cập nhật ngay trên màn hình, không đợi máy chủ.
      onMutate: async (ids) => {
        await qc.cancelQueries({ queryKey: keys.categories });
        const prev = qc.getQueryData<CategoryAdmin[]>(keys.categories);
        if (prev) {
          const byId = new Map(prev.map((c) => [c.id, c]));
          qc.setQueryData(
            keys.categories,
            ids.flatMap((id, order) => {
              const c = byId.get(id);
              return c ? [{ ...c, order }] : [];
            }),
          );
        }
        return { prev };
      },
      onError: (_e, _ids, ctx) => {
        if (ctx?.prev) qc.setQueryData(keys.categories, ctx.prev);
      },
      onSettled: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => del(`/admin/categories/${id}`),
      onSuccess: invalidate,
    }),
  };
}

// ───────────── Từ vựng ─────────────

export function useVocabularyList(q: VocabularyQuery) {
  return useQuery({
    queryKey: keys.vocabularyList(q),
    queryFn: () =>
      api<Paginated<VocabularyAdmin>>(`/admin/vocabulary${toSearch(q)}`),
    placeholderData: keepPreviousData,
  });
}

export function useVocabularyMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.vocabulary });
    void qc.invalidateQueries({ queryKey: keys.categories });
    void qc.invalidateQueries({ queryKey: keys.lessons });
  };
  return {
    create: useMutation({
      mutationFn: (body: VocabularyInput) =>
        postJson<VocabularyAdmin>('/admin/vocabulary', body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: VocabularyUpdate & { id: string }) =>
        patchJson<VocabularyAdmin>(`/admin/vocabulary/${id}`, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => del(`/admin/vocabulary/${id}`),
      onSuccess: invalidate,
    }),
    importCsv: useMutation({
      mutationFn: (body: VocabularyImportRequest) =>
        postJson<VocabularyImportResult>('/admin/vocabulary/import', body),
      onSuccess: (res) => {
        if (!res.dryRun) invalidate();
      },
    }),
  };
}

export const uploadImage = (file: File) =>
  uploadFile<{ url: string }>('/admin/media/images', file);
export const uploadAudio = (file: File) =>
  uploadFile<{ url: string }>('/admin/media/audio', file);

/** Tìm ảnh minh hoạ (Fluent Emoji, hoặc Pixabay nếu máy chủ có key). */
export function useImageSearch(q: ImageSearchQuery) {
  return useQuery({
    queryKey: ['admin', 'media-search', q] as const,
    queryFn: () =>
      api<ImageSearchResponse>(`/admin/media/search${toSearch(q)}`),
    enabled: !!q.q.trim(),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

/** Tải ảnh đã chọn về máy chủ; trả về đường dẫn /uploads/... */
export const importImage = (body: ImageImportRequest) =>
  postJson<{ url: string }>('/admin/media/import', body);

/** Tra từ điển: phiên âm, câu ví dụ và file đọc (đã tải về máy chủ). */
export const lookupDictionary = (word: string) =>
  postJson<DictionaryLookupResult>('/admin/media/dictionary', { word });

// ───────────── Bài học ─────────────

export function useLessons() {
  return useQuery({
    queryKey: keys.lessons,
    queryFn: () => api<LessonSummary[]>('/admin/lessons'),
  });
}

export function useLesson(id: string) {
  return useQuery({
    queryKey: keys.lesson(id),
    queryFn: () => api<LessonDetail>(`/admin/lessons/${id}`),
  });
}

export function useLessonPreview(id: string) {
  return useQuery({
    queryKey: keys.lessonPreview(id),
    queryFn: () => api<LessonGamePreview[]>(`/admin/lessons/${id}/preview`),
  });
}

export function useLessonMutations() {
  const qc = useQueryClient();
  const onLesson = (l: LessonDetail) => {
    qc.setQueryData(keys.lesson(l.id), l);
    void qc.invalidateQueries({ queryKey: keys.lessons, exact: true });
    void qc.invalidateQueries({ queryKey: keys.lessonPreview(l.id) });
  };
  return {
    create: useMutation({
      mutationFn: (body: LessonInput) =>
        postJson<LessonDetail>('/admin/lessons', body),
      onSuccess: onLesson,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: LessonUpdate & { id: string }) =>
        patchJson<LessonDetail>(`/admin/lessons/${id}`, body),
      onSuccess: onLesson,
    }),
    setWords: useMutation({
      mutationFn: ({
        id,
        vocabularyIds,
      }: {
        id: string;
        vocabularyIds: string[];
      }) =>
        putJson<LessonDetail>(`/admin/lessons/${id}/words`, { vocabularyIds }),
      onSuccess: onLesson,
    }),
    setQuestions: useMutation({
      mutationFn: ({
        id,
        questionIds,
      }: {
        id: string;
        questionIds: string[];
      }) =>
        putJson<LessonDetail>(`/admin/lessons/${id}/questions`, {
          questionIds,
        }),
      onSuccess: (l: LessonDetail) => {
        onLesson(l);
        // Số Unit dùng mỗi câu hỏi thay đổi.
        void qc.invalidateQueries({ queryKey: ['admin', 'questions'] });
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => del(`/admin/lessons/${id}`),
      onSuccess: (_v, id) => {
        qc.removeQueries({ queryKey: keys.lesson(id) });
        void qc.invalidateQueries({ queryKey: keys.lessons });
        void qc.invalidateQueries({ queryKey: keys.games });
      },
    }),
  };
}

// ───────────── Trò chơi ─────────────

export function useGames() {
  return useQuery({
    queryKey: keys.games,
    queryFn: () => api<GameAdmin[]>('/admin/games'),
  });
}

export function useUpdateGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, ...body }: GameUpdate & { slug: string }) =>
      patchJson<GameAdmin>(`/admin/games/${slug}`, body),
    onSuccess: (game) => {
      qc.setQueryData<GameAdmin[]>(keys.games, (list) =>
        list?.map((g) => (g.slug === game.slug ? game : g)),
      );
      void qc.invalidateQueries({ queryKey: keys.lessons });
    },
  });
}

// ───────────── Công khai ─────────────

export function usePublicCategories() {
  return useQuery({
    queryKey: ['content', 'categories'],
    queryFn: () => api<PublicCategory[]>('/content/categories'),
    staleTime: 5 * 60_000,
  });
}
