import {
  GAME_DEFINITIONS,
  GAME_GROUPS,
  type GameDefinition,
  type GameGroup,
} from '@novel/shared';
import {
  BookCheck,
  Blocks,
  Calculator,
  ChefHat,
  CircleHelp,
  Ear,
  AudioLines,
  Search,
  Rocket,
  ListOrdered,
  Network,
  SpellCheck,
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
import { GAME_COMPONENTS } from './registry';

export type Tint = 'sun' | 'tomato' | 'mint' | 'violet' | 'sky';

/** Class Tailwind viết đầy đủ để Tailwind quét được. */
export const TINT_BG: Record<Tint, string> = {
  sun: 'bg-sun',
  tomato: 'bg-tomato',
  mint: 'bg-mint',
  violet: 'bg-violet',
  sky: 'bg-sky',
};

/** Icon của từng game (dữ liệu game nằm ở @novel/shared, icon chỉ frontend cần). */
export const GAME_ICONS: Record<string, LucideIcon> = {
  'word-quiz': BookCheck,
  'picture-match': Images,
  'missing-letters': Puzzle,
  'word-builder': Blocks,
  'picture-quiz': CircleHelp,
  'spell-master': Ear,
  'word-runner': Footprints,
  'word-catcher': Sparkles,
  'typing-speed': Gauge,
  'word-battle': Swords,
  'vocabulary-duel': Zap,
  'typing-race': Flag,
  'color-world': Palette,
  'little-chef': ChefHat,
  'pet-care': PawPrint,
  'my-little-house': House,
  'math-rush': Calculator,
  'grammar-rush': Rocket,
  'sentence-builder': ListOrdered,
  'sound-stress': AudioLines,
  'word-family': Network,
  'error-hunter': Search,
};

const GROUP_STYLE: Record<GameGroup, { icon: LucideIcon; tint: Tint }> = {
  vocabulary: { icon: Puzzle, tint: 'sky' },
  grammar: { icon: SpellCheck, tint: 'sun' },
  typing: { icon: Keyboard, tint: 'violet' },
  battle: { icon: Swords, tint: 'tomato' },
  fun: { icon: Palette, tint: 'mint' },
};

export interface CatalogGame extends GameDefinition {
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

/** Game đã làm xong phần chơi = game có trong registry (Giai đoạn 4 sẽ bổ sung dần). */
const READY = new Set(Object.keys(GAME_COMPONENTS));

export const CATALOG: CatalogGroup[] = (
  Object.keys(GAME_GROUPS) as GameGroup[]
).map((id) => ({
  id,
  ...GAME_GROUPS[id],
  ...GROUP_STYLE[id],
  games: GAME_DEFINITIONS.filter((g) => g.group === id).map((g) => ({
    ...g,
    icon: GAME_ICONS[g.slug] ?? Puzzle,
    ready: READY.has(g.slug),
  })),
}));
