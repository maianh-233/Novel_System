import {
  Apple,
  Backpack,
  CaseSensitive,
  CupSoda,
  Hash,
  Heart,
  Palette,
  Rabbit,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { TINT_BG, type Tint } from '../../games/catalog';

// Khớp 9 chủ đề được seed trong database. Giai đoạn 2 sẽ lấy từ API.
const TOPICS: Array<{
  name: string;
  vi: string;
  icon: LucideIcon;
  tint: Tint;
}> = [
  { name: 'Alphabet', vi: 'Chữ cái', icon: CaseSensitive, tint: 'sky' },
  { name: 'Animals', vi: 'Con vật', icon: Rabbit, tint: 'mint' },
  { name: 'Fruits', vi: 'Hoa quả', icon: Apple, tint: 'tomato' },
  { name: 'Colors', vi: 'Màu sắc', icon: Palette, tint: 'violet' },
  { name: 'Numbers', vi: 'Con số', icon: Hash, tint: 'sun' },
  { name: 'Food & Drinks', vi: 'Đồ ăn', icon: CupSoda, tint: 'tomato' },
  { name: 'Family', vi: 'Gia đình', icon: Heart, tint: 'violet' },
  {
    name: 'School Objects',
    vi: 'Đồ dùng học tập',
    icon: Backpack,
    tint: 'sky',
  },
  { name: 'Daily Activities', vi: 'Hằng ngày', icon: Sun, tint: 'sun' },
];

export function TopicShelf() {
  return (
    <section aria-labelledby="topics-title">
      <h2
        id="topics-title"
        className="font-display text-3xl leading-tight font-extrabold"
      >
        Chủ đề
      </h2>
      <ul className="mt-4 flex flex-wrap gap-3">
        {TOPICS.map(({ name, vi, icon: Icon, tint }) => (
          <li
            key={name}
            className="sticker flex items-center gap-3 bg-white py-1.5 pr-4 pl-1.5"
          >
            <span
              aria-hidden
              className={`grid size-10 place-items-center rounded-[0.8rem] border-[2.5px] border-ink ${TINT_BG[tint]}`}
            >
              <Icon className="size-5" strokeWidth={2.5} />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-bold">
                {name}
              </span>
              <span className="block text-xs text-ink/65">{vi}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
