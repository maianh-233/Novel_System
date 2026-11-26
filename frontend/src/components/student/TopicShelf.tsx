import { usePublicCategories } from '../../hooks/useContentAdmin';
import { TINT_BG, type Tint } from '../../games/catalog';

const TINTS: Tint[] = ['sky', 'mint', 'tomato', 'violet', 'sun'];

/** Tên tiếng Việt cho các chủ đề có sẵn; chủ đề giáo viên tự tạo chỉ hiện tên gốc. */
const VI: Record<string, string> = {
  alphabet: 'Chữ cái',
  animals: 'Con vật',
  fruits: 'Hoa quả',
  colors: 'Màu sắc',
  numbers: 'Con số',
  'food-drinks': 'Đồ ăn',
  family: 'Gia đình',
  'school-objects': 'Đồ dùng học tập',
  'daily-activities': 'Hằng ngày',
};

export function TopicShelf() {
  const { data: topics, isPending, isError } = usePublicCategories();

  // Lỗi mạng hoặc chưa có chủ đề: ẩn hẳn khu này thay vì hiện khung trống.
  if (isError || (topics && topics.length === 0)) return null;

  return (
    <section aria-labelledby="topics-title" aria-busy={isPending}>
      <h2
        id="topics-title"
        className="font-display text-3xl leading-tight font-extrabold"
      >
        Chủ đề
      </h2>
      <ul className="mt-4 flex flex-wrap gap-3">
        {isPending
          ? Array.from({ length: 6 }, (_, i) => (
              <li
                key={i}
                aria-hidden
                className="sticker h-[3.25rem] w-36 animate-pulse bg-white/70"
              />
            ))
          : topics.map((t, i) => (
              <li
                key={t.id}
                className="sticker flex items-center gap-3 bg-white py-1.5 pr-4 pl-1.5"
              >
                <span
                  aria-hidden
                  className={`grid size-10 place-items-center rounded-[0.8rem] border-[2.5px] border-ink text-xl ${TINT_BG[TINTS[i % TINTS.length]]}`}
                >
                  {t.icon ?? '📚'}
                </span>
                <span className="leading-tight">
                  <span className="block font-display text-lg font-bold">
                    {t.name}
                  </span>
                  <span className="block text-xs text-ink/65">
                    {VI[t.slug] ? `${VI[t.slug]} · ` : ''}
                    {t.wordCount} từ
                  </span>
                </span>
              </li>
            ))}
      </ul>
    </section>
  );
}
