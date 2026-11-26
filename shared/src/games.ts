import { PRIMARY_MAX_GRADE, type Learner } from './classes.js';
import type { GameGroup, WordRequirement } from './game.js';

export interface GameConfig {
  /** Số từ mỗi lượt chơi. */
  wordsPerRound: number;
  /** Giới hạn thời gian mỗi lượt (giây); 0 = không giới hạn. */
  timeLimitSec: number;
}

export interface GameDefinition {
  slug: string;
  name: string;
  group: GameGroup;
  /** Mô tả ngắn cho học sinh. */
  blurb: string;
  /** Từ thiếu dữ liệu này sẽ không được đưa vào game. */
  requires: WordRequirement[];
  /** Ít nhất bao nhiêu từ hợp lệ thì game mới chơi được. */
  minWords: number;
  defaultConfig: GameConfig;
  /** Khối được chơi (gồm cả hai đầu). Không ghi = khối 1–9. */
  grades?: { min: number; max: number };
}

/** Game chỉ dành cho tiểu học. */
const PRIMARY_ONLY = { min: 1, max: PRIMARY_MAX_GRADE };
/** Game cần từ vựng cụ thể có hình: tiểu học và lớp 6. */
const UP_TO_GRADE_6 = { min: 1, max: 6 };

const cfg = (wordsPerRound: number, timeLimitSec = 0): GameConfig => ({
  wordsPerRound,
  timeLimitSec,
});

/**
 * Danh sách trò chơi — nguồn dữ liệu duy nhất cho cả backend (seed bảng Game)
 * và frontend (thư viện trò chơi). Thêm game mới: thêm một dòng ở đây.
 */
export const GAME_DEFINITIONS: GameDefinition[] = [
  // Học từ vựng
  {
    slug: 'word-quiz',
    name: 'Word Quiz',
    group: 'vocabulary',
    blurb: 'Đọc từ tiếng Anh rồi chọn nghĩa đúng.',
    requires: [],
    minWords: 4,
    defaultConfig: cfg(8),
  },
  {
    slug: 'picture-match',
    name: 'Picture Match',
    group: 'vocabulary',
    blurb: 'Nối mỗi bức hình với từ tiếng Anh đúng.',
    requires: ['image'],
    minWords: 4,
    defaultConfig: cfg(6),
    grades: UP_TO_GRADE_6,
  },
  {
    slug: 'missing-letters',
    name: 'Missing Letters',
    group: 'vocabulary',
    blurb: 'Điền chữ cái còn thiếu vào từ.',
    requires: [],
    minWords: 4,
    defaultConfig: cfg(8),
  },
  {
    slug: 'word-builder',
    name: 'Word Builder',
    group: 'vocabulary',
    blurb: 'Xếp các chữ cái lộn xộn thành từ.',
    requires: [],
    minWords: 4,
    defaultConfig: cfg(8),
  },
  {
    slug: 'picture-quiz',
    name: 'Picture Quiz',
    group: 'vocabulary',
    blurb: 'Nhìn hình rồi chọn từ đúng.',
    requires: ['image'],
    minWords: 4,
    defaultConfig: cfg(8),
    grades: UP_TO_GRADE_6,
  },
  {
    slug: 'spell-master',
    name: 'Spell Master',
    group: 'vocabulary',
    blurb: 'Nghe đọc rồi gõ lại từ.',
    requires: [],
    minWords: 4,
    defaultConfig: cfg(8),
  },
  // Luyện gõ phím
  {
    slug: 'word-runner',
    name: 'Word Runner',
    group: 'typing',
    blurb: 'Gõ từ để bạn nhỏ nhảy qua chướng ngại vật.',
    requires: [],
    minWords: 6,
    defaultConfig: cfg(15, 90),
  },
  {
    slug: 'word-catcher',
    name: 'Word Catcher',
    group: 'typing',
    blurb: 'Gõ từ trước khi nó rơi mất.',
    requires: [],
    minWords: 6,
    defaultConfig: cfg(15, 90),
  },
  {
    slug: 'typing-speed',
    name: 'Typing Speed',
    group: 'typing',
    blurb: 'Xem em gõ được bao nhiêu từ một phút.',
    requires: [],
    minWords: 10,
    defaultConfig: cfg(30, 60),
  },
  // Thi đấu
  {
    slug: 'word-battle',
    name: 'Word Battle',
    group: 'battle',
    blurb: 'Thi gõ đúng nhiều từ hơn bạn.',
    requires: [],
    minWords: 6,
    defaultConfig: cfg(10, 60),
  },
  {
    slug: 'vocabulary-duel',
    name: 'Vocabulary Duel',
    group: 'battle',
    blurb: 'Thi chọn từ đúng nhanh hơn bạn.',
    requires: [],
    minWords: 6,
    defaultConfig: cfg(10, 60),
  },
  {
    slug: 'typing-race',
    name: 'Typing Race',
    group: 'battle',
    blurb: 'Đua xe bằng tốc độ gõ phím.',
    requires: [],
    minWords: 10,
    defaultConfig: cfg(20, 60),
  },
  // Vui học
  {
    slug: 'color-world',
    name: 'Color World',
    group: 'fun',
    blurb: 'Tô màu và học tên các màu.',
    requires: [],
    minWords: 4,
    defaultConfig: cfg(6),
    grades: PRIMARY_ONLY,
  },
  {
    slug: 'little-chef',
    name: 'Little Chef',
    group: 'fun',
    blurb: 'Nấu món ăn theo công thức tiếng Anh.',
    requires: ['image'],
    minWords: 4,
    defaultConfig: cfg(6),
    grades: PRIMARY_ONLY,
  },
  {
    slug: 'pet-care',
    name: 'Pet Care',
    group: 'fun',
    blurb: 'Chăm sóc thú cưng của em.',
    requires: [],
    minWords: 4,
    defaultConfig: cfg(6),
    grades: PRIMARY_ONLY,
  },
  {
    slug: 'my-little-house',
    name: 'My Little House',
    group: 'fun',
    blurb: 'Xếp đồ vào đúng chỗ trong phòng.',
    requires: ['image'],
    minWords: 4,
    defaultConfig: cfg(6),
    grades: PRIMARY_ONLY,
  },
  {
    slug: 'math-rush',
    name: 'Math Rush',
    group: 'fun',
    blurb: 'Tính nhanh các phép toán.',
    requires: [],
    minWords: 0,
    defaultConfig: cfg(10, 60),
    grades: PRIMARY_ONLY,
  },
];

export const GAME_GROUPS: Record<GameGroup, { title: string; blurb: string }> =
  {
    vocabulary: {
      title: 'Học từ vựng',
      blurb: 'Nhìn hình, nghe đọc, ghép chữ thành từ.',
    },
    typing: { title: 'Luyện gõ phím', blurb: 'Gõ thật nhanh, thật đúng.' },
    battle: {
      title: 'Thi đấu cùng bạn',
      blurb: 'Hai bạn cùng chơi, ai nhanh hơn?',
    },
    fun: { title: 'Vui học', blurb: 'Nấu ăn, nuôi thú cưng, trang trí nhà.' },
  };

/** Em có thấy và chơi được game này không. Em chưa xếp lớp được coi là học sinh tiểu học. */
export function isGameForLearner(def: GameDefinition, learner: Learner) {
  const { min, max } = def.grades ?? { min: 1, max: 9 };
  if (learner.grade === null) return min <= PRIMARY_MAX_GRADE;
  return learner.grade >= min && learner.grade <= max;
}

export function findGame(slug: string): GameDefinition | undefined {
  return GAME_DEFINITIONS.find((g) => g.slug === slug);
}
