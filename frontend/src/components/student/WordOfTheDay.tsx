import { Volume2 } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { usePronounce } from '../../hooks/usePronounce';
import { TINT_BG, type Tint } from '../../games/catalog';

// Tạm thời lấy từ danh sách mẫu (khớp dữ liệu seed). Giai đoạn 2 sẽ lấy từ API.
const WORDS = [
  { word: 'butterfly', meaning: 'con bướm', ipa: '/ˈbʌtəflaɪ/', picture: '🦋' },
  { word: 'elephant', meaning: 'con voi', ipa: '/ˈelɪfənt/', picture: '🐘' },
  {
    word: 'watermelon',
    meaning: 'quả dưa hấu',
    ipa: '/ˈwɔːtəmelən/',
    picture: '🍉',
  },
  { word: 'banana', meaning: 'quả chuối', ipa: '/bəˈnɑːnə/', picture: '🍌' },
  { word: 'purple', meaning: 'màu tím', ipa: '/ˈpɜːpl/', picture: '💜' },
];

const TINTS: Tint[] = ['sun', 'tomato', 'mint', 'violet', 'sky'];
const TILTS = [-6, 4, -3, 5, -5, 3, -4, 6, -2, 4];

function wordForToday() {
  const day = Math.floor(Date.now() / 86_400_000);
  return WORDS[day % WORDS.length];
}

export function WordOfTheDay() {
  const [entry] = useState(wordForToday);
  const [wiggling, setWiggling] = useState<number | null>(null);
  const pronounce = usePronounce();

  const tapLetter = (i: number, letter: string) => {
    setWiggling(i);
    pronounce(letter);
  };

  return (
    <section
      aria-labelledby="wotd-title"
      className="sticker relative overflow-hidden bg-white px-5 pt-6 pb-7 sm:px-9 sm:pt-8 sm:pb-9"
    >
      <div className="flex items-start gap-8">
        <div className="min-w-0 flex-1">
          <h1
            id="wotd-title"
            className="font-display text-3xl leading-tight font-extrabold sm:text-4xl"
          >
            Chào em! Từ của hôm nay là…
          </h1>
          <p className="mt-1 text-base text-ink/70 sm:text-lg">
            Bấm vào từng chữ cái để nghe cách đọc.
          </p>

          <ol
            aria-label={`Đánh vần: ${entry.word.split('').join(' ')}`}
            className="mt-7 flex flex-wrap gap-1.5 sm:gap-3"
          >
            {entry.word.split('').map((letter, i) => (
              <li key={i}>
                <button
                  type="button"
                  aria-label={`Chữ ${letter.toUpperCase()}`}
                  onClick={() => tapLetter(i, letter)}
                  onAnimationEnd={() => setWiggling(null)}
                  style={
                    {
                      '--tilt': `${TILTS[i % TILTS.length]}deg`,
                      animationDelay: wiggling === null ? `${i * 70}ms` : '0ms',
                    } as CSSProperties
                  }
                  className={`sticker pressable grid size-11 cursor-pointer place-items-center font-display text-2xl font-extrabold uppercase sm:size-16 sm:text-4xl lg:size-20 lg:text-6xl ${TINT_BG[TINTS[i % TINTS.length]]} ${wiggling === i ? 'animate-wiggle' : 'animate-tile-drop'}`}
                >
                  {letter}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <span
          aria-hidden
          className="sticker hidden size-44 shrink-0 rotate-3 place-items-center bg-sun text-8xl md:grid lg:size-52 lg:text-9xl"
        >
          {entry.picture}
        </span>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
        <span aria-hidden className="text-5xl sm:text-6xl md:hidden">
          {entry.picture}
        </span>
        <div>
          <p className="font-display text-2xl leading-none font-bold sm:text-3xl">
            {entry.meaning}
          </p>
          <p className="mt-1 text-ink/60">{entry.ipa}</p>
        </div>
        <button
          type="button"
          onClick={() => pronounce(entry.word)}
          className="sticker pressable ml-auto inline-flex cursor-pointer items-center gap-2 bg-sun px-5 py-3 font-display text-xl font-bold"
        >
          <Volume2 aria-hidden className="size-6" strokeWidth={2.5} />
          Nghe đọc
        </button>
      </div>
    </section>
  );
}
