import type { GameProps } from '@novel/shared';
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Phần chơi của từng game, tải riêng khi học sinh mở game đó.
 * Thêm game mới: tạo thư mục `games/<slug>/` rồi thêm một dòng ở đây —
 * game tự hiện nút "Chơi" trong thư viện và dùng chung khung chơi, chấm sao, màn kết quả.
 */
export const GAME_COMPONENTS: Record<
  string,
  LazyExoticComponent<ComponentType<GameProps>>
> = {
  'word-quiz': lazy(() =>
    import('./word-quiz/WordQuiz').then((m) => ({ default: m.WordQuiz })),
  ),
  'picture-match': lazy(() =>
    import('./picture-match/PictureMatch').then((m) => ({
      default: m.PictureMatch,
    })),
  ),
  'missing-letters': lazy(() =>
    import('./missing-letters/MissingLetters').then((m) => ({
      default: m.MissingLetters,
    })),
  ),
  'word-builder': lazy(() =>
    import('./word-builder/WordBuilder').then((m) => ({
      default: m.WordBuilder,
    })),
  ),
  'picture-quiz': lazy(() =>
    import('./picture-quiz/PictureQuiz').then((m) => ({
      default: m.PictureQuiz,
    })),
  ),
  'word-runner': lazy(() =>
    import('./word-runner/WordRunner').then((m) => ({
      default: m.WordRunner,
    })),
  ),
};
