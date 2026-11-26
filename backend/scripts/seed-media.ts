/**
 * Gắn ảnh (Fluent Emoji) và file phát âm (Free Dictionary) cho các từ mẫu của seed.
 * Chạy lại nhiều lần vẫn an toàn: chỉ điền từ còn trống, không đè ảnh/âm thanh giáo viên đã chọn.
 *
 *   npm run db:seed-media -w backend            # cả ảnh và phát âm
 *   npm run db:seed-media -w backend -- --images  # chỉ ảnh
 *   npm run db:seed-media -w backend -- --audio   # chỉ phát âm
 *
 * Cần mạng internet; không cần key nào.
 */
import 'dotenv/config';
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateEnv, type Env } from '../src/config/env.js';
import { MediaService } from '../src/media/media.service.js';
import { RemoteMediaService } from '../src/media/remote-media.service.js';
import { StorageService } from '../src/media/storage.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Emoji cho từng từ mẫu, chọn bằng tay (tìm tự động dễ chọn nhầm, vd "orange" màu và quả).
 * Từ không có hình hợp (family, desk, eraser) để trống — giáo viên tìm trên Pixabay.
 */
const EMOJI: Record<string, Record<string, string>> = {
  animals: {
    cat: 'Cat face',
    dog: 'Dog face',
    bird: 'Bird',
    fish: 'Fish',
    duck: 'Duck',
    pig: 'Pig face',
    rabbit: 'Rabbit face',
    monkey: 'Monkey face',
    tiger: 'Tiger face',
    elephant: 'Elephant',
    butterfly: 'Butterfly',
    giraffe: 'Giraffe',
  },
  fruits: {
    apple: 'Red apple',
    banana: 'Banana',
    orange: 'Tangerine',
    mango: 'Mango',
    grape: 'Grapes',
    lemon: 'Lemon',
    pear: 'Pear',
    coconut: 'Coconut',
    pineapple: 'Pineapple',
    watermelon: 'Watermelon',
  },
  colors: {
    red: 'Red circle',
    blue: 'Blue circle',
    green: 'Green circle',
    yellow: 'Yellow circle',
    pink: 'Pink heart',
    black: 'Black circle',
    white: 'White circle',
    purple: 'Purple circle',
    orange: 'Orange circle',
    brown: 'Brown circle',
  },
  numbers: {
    one: 'Keycap 1',
    two: 'Keycap 2',
    three: 'Keycap 3',
    four: 'Keycap 4',
    five: 'Keycap 5',
    six: 'Keycap 6',
    seven: 'Keycap 7',
    eight: 'Keycap 8',
    nine: 'Keycap 9',
    ten: 'Keycap 10',
  },
  'food-drinks': {
    rice: 'Cooked rice',
    bread: 'Bread',
    milk: 'Glass of milk',
    water: 'Droplet',
    egg: 'Egg',
    cake: 'Shortcake',
    juice: 'Beverage box',
    noodles: 'Steaming bowl',
    chicken: 'Poultry leg',
    'ice cream': 'Soft ice cream',
  },
  family: {
    mother: 'Woman',
    father: 'Man',
    sister: 'Girl',
    brother: 'Boy',
    baby: 'Baby',
    grandmother: 'Old woman',
    grandfather: 'Old man',
  },
  'school-objects': {
    pen: 'Pen',
    pencil: 'Pencil',
    book: 'Closed book',
    bag: 'Backpack',
    chair: 'Chair',
    ruler: 'Straight ruler',
    notebook: 'Notebook',
    scissors: 'Scissors',
  },
  'daily-activities': {
    eat: 'Fork and knife with plate',
    drink: 'Cup with straw',
    sleep: 'Sleeping face',
    run: 'Person running',
    read: 'Open book',
    sing: 'Microphone',
    swim: 'Person swimming',
    draw: 'Artist palette',
    'brush teeth': 'Toothbrush',
    'go to school': 'School',
  },
};

/** Chữ cái: từ điển đọc "a" là mạo từ chứ không phải tên chữ cái → để trình duyệt đọc. */
const SKIP_AUDIO_CATEGORIES = new Set(['alphabet']);

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

function reason(e: unknown): string {
  if (e instanceof HttpException) {
    const body = e.getResponse() as { message?: string };
    return body.message ?? e.message;
  }
  return e instanceof Error ? e.message : String(e);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const doImages = !args.has('--audio') || args.has('--images');
  const doAudio = !args.has('--images') || args.has('--audio');

  // Tạo trực tiếp vài service cần dùng (tsx không sinh metadata để Nest tự tiêm phụ thuộc).
  const config = new ConfigService<Env, true>(validateEnv(process.env));
  const prisma = new PrismaService(config as unknown as ConfigService);
  const remote = new RemoteMediaService(
    new MediaService(new StorageService(config)),
    config,
  );
  const stats = { images: 0, audio: 0, skipped: [] as string[] };

  try {
    const categories = await prisma.category.findMany({
      where: { slug: { in: [...Object.keys(EMOJI), 'alphabet'] } },
      include: { words: { orderBy: { word: 'asc' } } },
    });

    for (const c of categories) {
      for (const w of c.words) {
        const label = `${c.slug}/${w.word}`;

        const emoji = EMOJI[c.slug]?.[w.word.toLowerCase()];
        if (doImages && emoji && !w.imageUrl) {
          try {
            const { url } = await remote.importImage('emoji', emoji);
            await prisma.vocabulary.update({
              where: { id: w.id },
              data: { imageUrl: url },
            });
            stats.images++;
          } catch (e) {
            stats.skipped.push(`${label} (ảnh): ${reason(e)}`);
          }
        }

        if (doAudio && !w.audioUrl && !SKIP_AUDIO_CATEGORIES.has(c.slug)) {
          try {
            const info = await remote.lookupDictionary(w.word);
            if (info.audioUrl) {
              await prisma.vocabulary.update({
                where: { id: w.id },
                // Chỉ điền âm thanh (và IPA nếu đang trống) — câu ví dụ để giáo viên tự chọn.
                data: { audioUrl: info.audioUrl, ipa: w.ipa ?? info.ipa },
              });
              stats.audio++;
            } else {
              stats.skipped.push(
                info.audioStatus === 'busy'
                  ? `${label} (phát âm): Wikimedia đang giới hạn lượt tải — chạy lại lệnh sau ít phút`
                  : `${label} (phát âm): từ điển không có file đọc`,
              );
            }
          } catch (e) {
            stats.skipped.push(`${label} (phát âm): ${reason(e)}`);
          }
          await pause(1500); // nhẹ tay với dịch vụ miễn phí (Wikimedia giới hạn tải liên tiếp)
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(`Xong: thêm ${stats.images} ảnh, ${stats.audio} file phát âm.`);
  if (stats.skipped.length) {
    console.log(
      `Bỏ qua ${stats.skipped.length} mục (trình duyệt sẽ tự đọc những từ thiếu âm thanh):`,
    );
    for (const s of stats.skipped) console.log(`  - ${s}`);
  }
}

await main();
