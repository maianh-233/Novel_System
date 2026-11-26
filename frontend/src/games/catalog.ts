import type { GameGroup } from '@novel/shared';
import {
  Blocks,
  Calculator,
  ChefHat,
  CircleHelp,
  Ear,
  Flag,
  Footprints,
  Gauge,
  House,
  Images,
  Keyboard,
  Palette,
  PawPrint,
  Puzzle,
  Sparkles,
  Swords,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type Tint = 'sun' | 'tomato' | 'mint' | 'violet' | 'sky';

/** Class Tailwind viết đầy đủ để Tailwind quét được. */
export const TINT_BG: Record<Tint, string> = {
  sun: 'bg-sun',
  tomato: 'bg-tomato',
  mint: 'bg-mint',
  violet: 'bg-violet',
  sky: 'bg-sky',
};

export interface CatalogGame {
  slug: string;
  name: string;
  /** Mô tả ngắn cho học sinh, viết bằng lời của các em. */
  blurb: string;
  icon: LucideIcon;
  /** false = chưa làm xong; hiện nhãn "Sắp có". */
  ready: boolean;
}

export interface CatalogGroup {
  id: GameGroup;
  title: string;
  blurb: string;
  icon: LucideIcon;
  tint: Tint;
  games: CatalogGame[];
}

// Từ Giai đoạn 3, `ready` sẽ lấy từ Game Registry + cấu hình trong Admin.
export const CATALOG: CatalogGroup[] = [
  {
    id: 'vocabulary',
    title: 'Học từ vựng',
    blurb: 'Nhìn hình, nghe đọc, ghép chữ thành từ.',
    icon: Puzzle,
    tint: 'sky',
    games: [
      {
        slug: 'picture-match',
        name: 'Picture Match',
        blurb: 'Nối mỗi bức hình với từ tiếng Anh đúng.',
        icon: Images,
        ready: false,
      },
      {
        slug: 'missing-letters',
        name: 'Missing Letters',
        blurb: 'Điền chữ cái còn thiếu vào từ.',
        icon: Puzzle,
        ready: false,
      },
      {
        slug: 'word-builder',
        name: 'Word Builder',
        blurb: 'Xếp các chữ cái lộn xộn thành từ.',
        icon: Blocks,
        ready: false,
      },
      {
        slug: 'picture-quiz',
        name: 'Picture Quiz',
        blurb: 'Nhìn hình rồi chọn từ đúng.',
        icon: CircleHelp,
        ready: false,
      },
      {
        slug: 'spell-master',
        name: 'Spell Master',
        blurb: 'Nghe đọc rồi gõ lại từ.',
        icon: Ear,
        ready: false,
      },
    ],
  },
  {
    id: 'typing',
    title: 'Luyện gõ phím',
    blurb: 'Gõ thật nhanh, thật đúng.',
    icon: Keyboard,
    tint: 'violet',
    games: [
      {
        slug: 'word-runner',
        name: 'Word Runner',
        blurb: 'Gõ từ để bạn nhỏ nhảy qua chướng ngại vật.',
        icon: Footprints,
        ready: false,
      },
      {
        slug: 'word-catcher',
        name: 'Word Catcher',
        blurb: 'Gõ từ trước khi nó rơi mất.',
        icon: Sparkles,
        ready: false,
      },
      {
        slug: 'typing-speed',
        name: 'Typing Speed',
        blurb: 'Xem em gõ được bao nhiêu từ một phút.',
        icon: Gauge,
        ready: false,
      },
    ],
  },
  {
    id: 'battle',
    title: 'Thi đấu cùng bạn',
    blurb: 'Hai bạn cùng chơi, ai nhanh hơn?',
    icon: Swords,
    tint: 'tomato',
    games: [
      {
        slug: 'word-battle',
        name: 'Word Battle',
        blurb: 'Thi gõ đúng nhiều từ hơn bạn.',
        icon: Swords,
        ready: false,
      },
      {
        slug: 'vocabulary-duel',
        name: 'Vocabulary Duel',
        blurb: 'Thi chọn từ đúng nhanh hơn bạn.',
        icon: Zap,
        ready: false,
      },
      {
        slug: 'typing-race',
        name: 'Typing Race',
        blurb: 'Đua xe bằng tốc độ gõ phím.',
        icon: Flag,
        ready: false,
      },
    ],
  },
  {
    id: 'fun',
    title: 'Vui học',
    blurb: 'Nấu ăn, nuôi thú cưng, trang trí nhà.',
    icon: Palette,
    tint: 'mint',
    games: [
      {
        slug: 'color-world',
        name: 'Color World',
        blurb: 'Tô màu và học tên các màu.',
        icon: Palette,
        ready: false,
      },
      {
        slug: 'little-chef',
        name: 'Little Chef',
        blurb: 'Nấu món ăn theo công thức tiếng Anh.',
        icon: ChefHat,
        ready: false,
      },
      {
        slug: 'pet-care',
        name: 'Pet Care',
        blurb: 'Chăm sóc thú cưng của em.',
        icon: PawPrint,
        ready: false,
      },
      {
        slug: 'my-little-house',
        name: 'My Little House',
        blurb: 'Xếp đồ vào đúng chỗ trong phòng.',
        icon: House,
        ready: false,
      },
      {
        slug: 'math-rush',
        name: 'Math Rush',
        blurb: 'Tính nhanh các phép toán.',
        icon: Calculator,
        ready: false,
      },
    ],
  },
];
