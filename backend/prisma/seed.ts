/**
 * Dữ liệu khởi tạo. Chạy lại nhiều lần vẫn an toàn (upsert).
 *   npm run db:seed
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/common/password.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const CATEGORIES = [
  { slug: 'alphabet', name: 'Alphabet', icon: '🔤' },
  { slug: 'animals', name: 'Animals', icon: '🐶' },
  { slug: 'fruits', name: 'Fruits', icon: '🍎' },
  { slug: 'colors', name: 'Colors', icon: '🎨' },
  { slug: 'numbers', name: 'Numbers', icon: '🔢' },
  { slug: 'food-drinks', name: 'Food & Drinks', icon: '🍔' },
  { slug: 'family', name: 'Family', icon: '👨‍👩‍👧' },
  { slug: 'school-objects', name: 'School Objects', icon: '✏️' },
  { slug: 'daily-activities', name: 'Daily Activities', icon: '⏰' },
];

// Một ít từ mẫu để thử game; giáo viên sẽ bổ sung trong Admin Dashboard.
const SAMPLE_WORDS: Record<string, Array<[string, string, string]>> = {
  animals: [
    ['cat', 'con mèo', '/kæt/'],
    ['dog', 'con chó', '/dɒɡ/'],
    ['bird', 'con chim', '/bɜːd/'],
    ['fish', 'con cá', '/fɪʃ/'],
    ['butterfly', 'con bướm', '/ˈbʌtəflaɪ/'],
    ['elephant', 'con voi', '/ˈelɪfənt/'],
  ],
  fruits: [
    ['apple', 'quả táo', '/ˈæpl/'],
    ['banana', 'quả chuối', '/bəˈnɑːnə/'],
    ['orange', 'quả cam', '/ˈɒrɪndʒ/'],
    ['mango', 'quả xoài', '/ˈmæŋɡəʊ/'],
    ['grape', 'quả nho', '/ɡreɪp/'],
    ['watermelon', 'quả dưa hấu', '/ˈwɔːtəmelən/'],
  ],
  colors: [
    ['red', 'màu đỏ', '/red/'],
    ['blue', 'màu xanh dương', '/bluː/'],
    ['green', 'màu xanh lá', '/ɡriːn/'],
    ['yellow', 'màu vàng', '/ˈjeləʊ/'],
    ['pink', 'màu hồng', '/pɪŋk/'],
    ['purple', 'màu tím', '/ˈpɜːpl/'],
  ],
};

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

  for (const [order, c] of CATEGORIES.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, order },
    });

    for (const [word, meaning, ipa] of SAMPLE_WORDS[c.slug] ?? []) {
      await prisma.vocabulary.upsert({
        where: { word_categoryId: { word, categoryId: category.id } },
        update: {},
        create: { word, meaning, ipa, categoryId: category.id },
      });
    }
  }

  const words = await prisma.vocabulary.count();
  console.log(
    `Seed xong: admin "${username}", ${CATEGORIES.length} chủ đề, ${words} từ vựng.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
