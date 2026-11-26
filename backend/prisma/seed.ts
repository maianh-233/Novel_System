/**
 * Dữ liệu khởi tạo. Chạy lại nhiều lần vẫn an toàn (không ghi đè chỉnh sửa của giáo viên).
 *   npm run db:seed
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { GAME_DEFINITIONS } from '@novel/shared';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/common/password.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type W = [word: string, meaning: string, ipa: string, level?: number];

const CATEGORIES: Array<{
  slug: string;
  name: string;
  icon: string;
  words: W[];
}> = [
  {
    slug: 'alphabet',
    name: 'Alphabet',
    icon: '🔤',
    words: [
      ['A', 'chữ A', '/eɪ/'],
      ['B', 'chữ B', '/biː/'],
      ['C', 'chữ C', '/siː/'],
      ['D', 'chữ D', '/diː/'],
      ['E', 'chữ E', '/iː/'],
      ['F', 'chữ F', '/ef/'],
      ['G', 'chữ G', '/dʒiː/'],
      ['H', 'chữ H', '/eɪtʃ/'],
    ],
  },
  {
    slug: 'animals',
    name: 'Animals',
    icon: '🐶',
    words: [
      ['cat', 'con mèo', '/kæt/'],
      ['dog', 'con chó', '/dɒɡ/'],
      ['bird', 'con chim', '/bɜːd/'],
      ['fish', 'con cá', '/fɪʃ/'],
      ['duck', 'con vịt', '/dʌk/'],
      ['pig', 'con lợn', '/pɪɡ/'],
      ['rabbit', 'con thỏ', '/ˈræbɪt/', 2],
      ['monkey', 'con khỉ', '/ˈmʌŋki/', 2],
      ['tiger', 'con hổ', '/ˈtaɪɡə/', 2],
      ['elephant', 'con voi', '/ˈelɪfənt/', 3],
      ['butterfly', 'con bướm', '/ˈbʌtəflaɪ/', 3],
      ['giraffe', 'con hươu cao cổ', '/dʒəˈrɑːf/', 3],
    ],
  },
  {
    slug: 'fruits',
    name: 'Fruits',
    icon: '🍎',
    words: [
      ['apple', 'quả táo', '/ˈæpl/'],
      ['banana', 'quả chuối', '/bəˈnɑːnə/'],
      ['orange', 'quả cam', '/ˈɒrɪndʒ/'],
      ['mango', 'quả xoài', '/ˈmæŋɡəʊ/'],
      ['grape', 'quả nho', '/ɡreɪp/'],
      ['lemon', 'quả chanh', '/ˈlemən/', 2],
      ['pear', 'quả lê', '/peə/', 2],
      ['coconut', 'quả dừa', '/ˈkəʊkənʌt/', 2],
      ['pineapple', 'quả dứa', '/ˈpaɪnæpl/', 3],
      ['watermelon', 'quả dưa hấu', '/ˈwɔːtəmelən/', 3],
    ],
  },
  {
    slug: 'colors',
    name: 'Colors',
    icon: '🎨',
    words: [
      ['red', 'màu đỏ', '/red/'],
      ['blue', 'màu xanh dương', '/bluː/'],
      ['green', 'màu xanh lá', '/ɡriːn/'],
      ['yellow', 'màu vàng', '/ˈjeləʊ/'],
      ['pink', 'màu hồng', '/pɪŋk/'],
      ['black', 'màu đen', '/blæk/'],
      ['white', 'màu trắng', '/waɪt/'],
      ['purple', 'màu tím', '/ˈpɜːpl/', 2],
      ['orange', 'màu cam', '/ˈɒrɪndʒ/', 2],
      ['brown', 'màu nâu', '/braʊn/', 2],
    ],
  },
  {
    slug: 'numbers',
    name: 'Numbers',
    icon: '🔢',
    words: [
      ['one', 'số một', '/wʌn/'],
      ['two', 'số hai', '/tuː/'],
      ['three', 'số ba', '/θriː/'],
      ['four', 'số bốn', '/fɔː/'],
      ['five', 'số năm', '/faɪv/'],
      ['six', 'số sáu', '/sɪks/'],
      ['seven', 'số bảy', '/ˈsevn/'],
      ['eight', 'số tám', '/eɪt/'],
      ['nine', 'số chín', '/naɪn/'],
      ['ten', 'số mười', '/ten/'],
    ],
  },
  {
    slug: 'food-drinks',
    name: 'Food & Drinks',
    icon: '🍔',
    words: [
      ['rice', 'cơm', '/raɪs/'],
      ['bread', 'bánh mì', '/bred/'],
      ['milk', 'sữa', '/mɪlk/'],
      ['water', 'nước', '/ˈwɔːtə/'],
      ['egg', 'quả trứng', '/eɡ/'],
      ['cake', 'bánh ngọt', '/keɪk/'],
      ['juice', 'nước ép', '/dʒuːs/', 2],
      ['noodles', 'mì', '/ˈnuːdlz/', 2],
      ['chicken', 'thịt gà', '/ˈtʃɪkɪn/', 2],
      ['ice cream', 'kem', '/ˌaɪs ˈkriːm/', 2],
    ],
  },
  {
    slug: 'family',
    name: 'Family',
    icon: '👨‍👩‍👧',
    words: [
      ['mother', 'mẹ', '/ˈmʌðə/'],
      ['father', 'bố', '/ˈfɑːðə/'],
      ['sister', 'chị/em gái', '/ˈsɪstə/'],
      ['brother', 'anh/em trai', '/ˈbrʌðə/'],
      ['baby', 'em bé', '/ˈbeɪbi/'],
      ['grandmother', 'bà', '/ˈɡrænmʌðə/', 2],
      ['grandfather', 'ông', '/ˈɡrænfɑːðə/', 2],
      ['family', 'gia đình', '/ˈfæməli/', 2],
    ],
  },
  {
    slug: 'school-objects',
    name: 'School Objects',
    icon: '✏️',
    words: [
      ['pen', 'cái bút', '/pen/'],
      ['pencil', 'bút chì', '/ˈpensl/'],
      ['book', 'quyển sách', '/bʊk/'],
      ['bag', 'cặp sách', '/bæɡ/'],
      ['desk', 'bàn học', '/desk/'],
      ['chair', 'cái ghế', '/tʃeə/'],
      ['ruler', 'thước kẻ', '/ˈruːlə/', 2],
      ['eraser', 'cục tẩy', '/ɪˈreɪzə/', 2],
      ['notebook', 'quyển vở', '/ˈnəʊtbʊk/', 2],
      ['scissors', 'cái kéo', '/ˈsɪzəz/', 3],
    ],
  },
  {
    slug: 'daily-activities',
    name: 'Daily Activities',
    icon: '⏰',
    words: [
      ['eat', 'ăn', '/iːt/'],
      ['drink', 'uống', '/drɪŋk/'],
      ['sleep', 'ngủ', '/sliːp/'],
      ['run', 'chạy', '/rʌn/'],
      ['read', 'đọc', '/riːd/'],
      ['sing', 'hát', '/sɪŋ/'],
      ['swim', 'bơi', '/swɪm/', 2],
      ['draw', 'vẽ', '/drɔː/', 2],
      ['brush teeth', 'đánh răng', '/brʌʃ tiːθ/', 2],
      ['go to school', 'đi học', '/ɡəʊ tə skuːl/', 3],
    ],
  },
];

/** Bài học mẫu: lấy các từ cấp 1–2 của một chủ đề, gán cho các game từ vựng không cần hình. */
const SAMPLE_LESSONS = [
  {
    title: 'Con vật quanh em',
    description: 'Những con vật quen thuộc.',
    category: 'animals',
  },
  { title: 'Hoa quả', description: 'Các loại quả ngon.', category: 'fruits' },
  {
    title: 'Màu sắc',
    description: 'Tên các màu thường gặp.',
    category: 'colors',
  },
];
const SAMPLE_LESSON_GAMES = [
  'word-quiz',
  'missing-letters',
  'word-builder',
  'spell-master',
  'word-runner',
];
/** Game ra đời sau bài học mẫu — xem cuối hàm main. */
const LATE_GAMES = ['word-quiz', 'picture-match'];

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('Thiếu ADMIN_USERNAME hoặc ADMIN_PASSWORD trong .env');
  }

  // Chỉ đặt mật khẩu khi tạo mới — chạy seed lại không ghi đè mật khẩu giáo viên đã đổi.
  await prisma.admin.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash: await hashPassword(password) },
  });

  const categoryIds = new Map<string, string>();
  for (const [order, c] of CATEGORIES.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { slug: c.slug, name: c.name, icon: c.icon, order },
    });
    categoryIds.set(c.slug, category.id);

    for (const [word, meaning, ipa, level = 1] of c.words) {
      await prisma.vocabulary.upsert({
        where: { word_categoryId: { word, categoryId: category.id } },
        update: {},
        create: { word, meaning, ipa, level, categoryId: category.id },
      });
    }
  }

  for (const g of GAME_DEFINITIONS) {
    await prisma.game.upsert({
      where: { slug: g.slug },
      update: {},
      create: { slug: g.slug, config: { ...g.defaultConfig } },
    });
  }

  // Bài học mẫu chỉ tạo khi chưa có bài học nào — không đụng vào bài học giáo viên đã làm.
  if ((await prisma.lesson.count()) === 0) {
    const games = await prisma.game.findMany({
      where: { slug: { in: SAMPLE_LESSON_GAMES } },
    });
    for (const s of SAMPLE_LESSONS) {
      const words = await prisma.vocabulary.findMany({
        where: { categoryId: categoryIds.get(s.category), level: { lte: 2 } },
        orderBy: [{ level: 'asc' }, { word: 'asc' }],
      });
      await prisma.lesson.create({
        data: {
          title: s.title,
          description: s.description,
          isPublished: true,
          words: {
            create: words.map((w, order) => ({ vocabularyId: w.id, order })),
          },
          games: { create: games.map((g) => ({ gameId: g.id })) },
        },
      });
    }
  }

  // Game làm xong sau khi đã có bài học mẫu (Word Quiz ở Giai đoạn 3, các game của Giai đoạn 4):
  // nếu game chưa được gán bài học nào thì gán mọi bài đã công khai, để học sinh chơi thử được ngay.
  // Bài nào thiếu từ hợp lệ (vd: chưa đủ từ có hình) thì không hiện cho học sinh — xem word-selection.
  const published = await prisma.lesson.findMany({
    where: { isPublished: true },
    select: { id: true },
  });
  for (const slug of LATE_GAMES) {
    const game = await prisma.game.findUniqueOrThrow({
      where: { slug },
      include: { _count: { select: { lessons: true } } },
    });
    if (game._count.lessons > 0) continue;
    await prisma.gameLesson.createMany({
      data: published.map((l) => ({ gameId: game.id, lessonId: l.id })),
      skipDuplicates: true,
    });
  }

  const [words, lessons] = await Promise.all([
    prisma.vocabulary.count(),
    prisma.lesson.count(),
  ]);
  console.log(
    `Seed xong: admin "${username}", ${CATEGORIES.length} chủ đề, ${words} từ vựng, ${GAME_DEFINITIONS.length} trò chơi, ${lessons} bài học.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
