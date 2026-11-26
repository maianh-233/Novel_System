# 🗺️ Kế hoạch sản xuất Novel Game

Tài liệu này biến README thành một lộ trình làm được ngay: chốt kiến trúc, mô hình dữ liệu, thứ tự xây dựng, và tiêu chí "xong" cho từng giai đoạn.

> Giả định: làm 1 người (hoặc nhóm nhỏ), khoảng 10–15 giờ/tuần. Ước lượng thời gian bên dưới tính theo giả định này — làm nhiều giờ hơn thì rút ngắn tương ứng.

👉 Mở rộng cho học sinh cấp 2 (lớp 6–9: ngân hàng câu hỏi, luyện đề, bài tập về nhà, ôn thi vào lớp 10): xem [PLAN-CAP2.md](PLAN-CAP2.md).

---

## 0. Nguyên tắc chính

1. **Làm MVP trước, mở rộng sau.** README có 16 mini-game; bản đầu tiên chỉ cần 3 game chạy thật trên kho từ vựng thật.
2. **Kho từ vựng là trái tim.** Mọi game đều đọc từ cùng một API nội dung. Không game nào được hard-code từ vựng.
3. **Game là plugin.** Thêm game mới = thêm 1 thư mục + 1 dòng đăng ký, không sửa phần còn lại của hệ thống.
4. **Chỉ dùng Phaser khi cần.** Game dạng quiz/kéo-thả làm bằng React + CSS; chỉ game có chuyển động liên tục (Word Runner, Word Catcher) mới dùng Phaser (bản 4 — API gần như giữ nguyên từ bản 3).
5. **Multiplayer để sau cùng.** Real-time (Socket.IO) tốn công nhất và dễ lỗi nhất → dời Word Battle sang giai đoạn mở rộng (README đang để ở Phase 3).

---

## 1. Chốt công nghệ

| Phần | Lựa chọn | Lý do |
|---|---|---|
| Monorepo | npm workspaces: `frontend/`, `backend/`, `shared/` | Dùng chung type (Vocabulary, GameResult…) giữa FE và BE |
| Frontend | Vite + React + TypeScript | Nhanh, đơn giản hơn Next.js cho app SPA |
| Routing / data | React Router, TanStack Query | Cache API, loading/error state có sẵn |
| Styling | Tailwind CSS | Như README |
| Game | React + CSS animation; Phaser 4 cho game hành động | Xem nguyên tắc 4 |
| Backend | NestJS + Prisma ORM | Prisma cho migration + type-safe query |
| Database | PostgreSQL (Docker khi dev) | Như README |
| Lưu file ảnh/âm thanh | Dev: thư mục `uploads/` local · Prod: S3-compatible (Cloudflare R2 / MinIO) | Tách storage ra 1 service để đổi dễ |
| Auth | JWT trong cookie `httpOnly` | Không để token trong localStorage |
| Phát âm dự phòng | Web Speech API (`speechSynthesis`) | Từ nào chưa có file audio vẫn đọc được |
| Real-time | Socket.IO (giai đoạn 5) | Như README |
| Test | Vitest (FE + BE), Playwright (E2E) | |
| CI | GitHub Actions: lint + typecheck + test | |

---

## 2. Kiến trúc tổng thể

```text
┌──────────────────────── frontend (React) ────────────────────────┐
│  /admin/*  Admin Dashboard     │   /play/*  Student Platform      │
│                                │   ┌─ Game Registry ────────────┐ │
│                                │   │ picture-match  (React)     │ │
│                                │   │ missing-letters (React)    │ │
│                                │   │ word-builder   (React)     │ │
│                                │   │ word-runner    (Phaser)    │ │
│                                │   └────────────────────────────┘ │
└───────────────┬──────────────────────────────┬───────────────────┘
                │ REST /api/admin/*            │ REST /api/play/*
┌───────────────▼──────────────────────────────▼───────────────────┐
│ backend (NestJS): auth · vocabulary · categories · lessons ·     │
│ games · play-sessions · students · achievements · analytics ·    │
│ media                                                            │
└───────────────┬──────────────────────────────┬───────────────────┘
          PostgreSQL                    File storage (local / R2)
```

### 2.1. Hợp đồng chung giữa game và nền tảng (quan trọng nhất)

Đặt trong `shared/`:

```ts
// Nền tảng đưa cho game
interface GameContent {
  sessionId: string;
  lessonId: string;
  level: 1 | 2 | 3;
  words: Array<{
    id: string; word: string; meaning: string;
    ipa?: string; imageUrl?: string; audioUrl?: string; example?: string;
  }>;
}

// Game trả lại cho nền tảng khi kết thúc
interface GameResult {
  sessionId: string;
  score: number;
  durationMs: number;
  answers: Array<{ vocabularyId: string; correct: boolean; attempts: number }>;
}

// Mỗi game tự khai báo
interface GameManifest {
  slug: string;                    // 'picture-match'
  name: string;
  group: 'typing' | 'vocabulary' | 'battle' | 'fun';
  requires: Array<'image' | 'audio'>;   // lọc bỏ từ thiếu dữ liệu
  minWords: number;
  component: React.LazyExoticComponent<React.FC<{
    content: GameContent; onFinish: (r: GameResult) => void;
  }>>;
}
```

Luồng chơi: học sinh chọn game + bài học → `POST /api/play/sessions` (backend chọn từ theo cấu hình, trả `GameContent`) → game chạy → `POST /api/play/sessions/:id/finish` với `GameResult` → backend tính sao, cộng điểm, mở huy hiệu.

Nhờ hợp đồng này, **analytics và thành tích được làm 1 lần cho mọi game**.

---

## 3. Mô hình dữ liệu (Prisma)

| Bảng | Trường chính | Ghi chú |
|---|---|---|
| `Admin` | id, username, passwordHash | Chỉ 1 bản ghi, tạo bằng seed từ biến môi trường |
| `Category` | id, name, slug, icon, isHidden, order | Alphabet, Animals, Fruits… |
| `Vocabulary` | id, word, meaning, ipa, imageUrl, audioUrl, example, categoryId, level (1–3), status (active/inactive) | "Xóa" = chuyển `inactive` để không hỏng lịch sử chơi |
| `Lesson` | id, title, description, level, isPublished | "Bộ từ vựng theo bài học", có thể trộn nhiều chủ đề |
| `LessonVocabulary` | lessonId, vocabularyId, order | N–N |
| `Game` | id, slug, isEnabled, config (JSON) | Bản ghi tương ứng mỗi `GameManifest`; config: số từ/lượt, thời gian… |
| `GameLesson` | gameId, lessonId | Bài học nào được dùng cho game nào |
| `Student` | id, displayName, username, passwordHash, avatar, totalStars, totalPoints | **Không** lưu email, ngày sinh, SĐT |
| `PlaySession` | id, studentId, gameId, lessonId, score, stars, correctCount, wrongCount, durationMs, startedAt, finishedAt | |
| `PlayAnswer` | sessionId, vocabularyId, correct, attempts | Cơ sở cho thống kê theo từ / chủ đề |
| `Badge` | id, code, name, icon, rule (JSON) | Ví dụ: "Chơi 10 lượt", "Đúng 100 từ Animals" |
| `StudentBadge` | studentId, badgeId, earnedAt | |

---

## 4. Lộ trình theo giai đoạn

Mỗi giai đoạn có **Định nghĩa "xong"** — chưa đạt thì chưa sang giai đoạn sau.

### Giai đoạn 0 — Khởi tạo dự án ✅ (xong 26/11/2026)

- [x] Tạo monorepo npm workspaces: `frontend/`, `backend/`, `shared/`, `docs/`.
- [x] `docker-compose.yml` chạy PostgreSQL 17 (cổng máy **55432**, vì 5432/5433 trên máy dev đã có Postgres khác).
- [x] NestJS 12 + Prisma 7, migration `init` với đủ 12 bảng ở mục 3, script seed (admin + 9 chủ đề + 18 từ mẫu).
- [x] Vite + React 19 + TS + Tailwind 4 + React Router + TanStack Query.
- [x] oxlint, Prettier, `.env.example`, GitHub Actions (format + typecheck + lint + test + e2e + build).
- [x] Ghi lệnh chạy dự án vào README.
- [x] Thêm: giao diện học sinh phong cách "vở dán sticker" (font Baloo 2 + Lexend nhúng sẵn, icon lucide-react, "Từ của hôm nay" bấm để nghe đọc).

**Xong khi:** `npm run dev` bật cả FE + BE, FE gọi được `GET /api/health`, CI xanh.

### Giai đoạn 1 — Nền tảng + xác thực ✅ (xong 26/11/2026)

- [x] Module `auth`: đăng nhập / đăng xuất / đổi mật khẩu admin. Guard **toàn cục** bảo vệ mọi `/api/admin/*` (route mới thêm sau được bảo vệ mặc định, chỉ mở khi gắn `@PublicAdmin()`).
- [x] Phiên đăng nhập: JWT (HS256) trong cookie `httpOnly` + `SameSite=Lax` + `Path=/api`, hết hạn sau `ADMIN_SESSION_HOURS` (mặc định 12 giờ). Đổi mật khẩu → mọi phiên cũ mất hiệu lực.
- [x] Seed tài khoản admin từ biến môi trường (`ADMIN_USERNAME`, `ADMIN_PASSWORD`).
- [x] Rate-limit: 5 lần đăng nhập/phút/IP, 120 request/phút/IP cho phần còn lại.
- [x] Validation bằng Zod, schema dùng chung FE + BE trong `@novel/shared`.
- [x] Layout Admin (sidebar có icon, menu thu gọn trên điện thoại, nút đăng xuất) và trang tạm cho các mục chưa làm.
- [x] Layout Student, design token, Trang chủ Student + Thư viện trò chơi (làm sớm ở Giai đoạn 0).

**Xong khi:** vào `/admin` mà chưa đăng nhập bị đẩy về trang login; gọi API admin không có cookie trả 401. → Có test e2e kiểm tra.

### Giai đoạn 2 — Quản trị nội dung ✅ (xong 26/11/2026)

- [x] CRUD Chủ đề (thêm, sửa, ẩn, sắp xếp lên/xuống). Không xoá được chủ đề còn từ — gợi ý ẩn thay thế.
- [x] CRUD Từ vựng: đủ trường, tìm theo từ hoặc nghĩa, lọc chủ đề/cấp độ/trạng thái, phân trang (bộ lọc lưu trên URL). Chặn từ trùng trong cùng chủ đề (không phân biệt hoa thường). Từ đã có học sinh chơi không xoá được — chuyển "Ngừng dùng".
- [x] Module `media`: tải ảnh (kiểm tra nội dung thật của file, thu về WebP cạnh dài 800px, bỏ EXIF/GPS) và âm thanh (MP3/M4A/OGG/WAV/WebM ≤ 3 MB); xem trước & nghe thử ngay trong form. Lưu ở `backend/uploads/` (đổi bằng `UPLOAD_DIR`).
- [x] Nhập CSV: kiểm tra trước, báo lỗi theo số dòng; có lỗi thì không ghi dòng nào; từ đã có được cập nhật. Có file mẫu tải về.
- [x] CRUD Bài học: chọn từ từ nhiều chủ đề, sắp xếp thứ tự, công khai/bản nháp.
- [x] Trang Trò chơi: bật/tắt, số từ mỗi lượt, thời gian, gán bài học. Danh sách game dùng chung FE + BE (`GAME_DEFINITIONS` trong `@novel/shared`).
- [x] **Xem trước theo game**: với mỗi bài học, game nào chơi được, từ nào bị loại và vì sao (vd: "Thiếu hình ảnh").
- [x] Seed: 9 chủ đề, 88 từ, 16 trò chơi, 3 bài học mẫu. Trang chủ học sinh lấy chủ đề thật từ `GET /api/content/categories`.
- [x] Code khu Admin tách file riêng, chỉ tải khi vào `/admin`.

**Xong khi:** giáo viên thêm từ `Butterfly` (có ảnh + audio) vào Animals, đưa vào một bài học, và game nhận được từ đó. → Test e2e `content.e2e-spec.ts` kiểm tra đúng luồng này qua API xem trước (`GET /api/admin/lessons/:id/preview`); API phát nội dung cho học sinh (`POST /api/play/sessions`) dùng chung logic chọn từ và sẽ có ở Giai đoạn 3.

### Giai đoạn 3 — Tài khoản học sinh + vòng lặp chơi ✅ (xong 26/11/2026)

> Đưa lên trước game vì mọi game cần nơi để lưu kết quả.

- [x] Admin → Học sinh: dán danh sách tên (mỗi dòng một em, tối đa 60) → hệ thống tự tạo tên đăng nhập từ tên gọi (vd: "Nguyễn Văn An" → `an42`) và mật khẩu dễ gõ (vd: `panda427`). Mật khẩu chỉ hiện một lần, **in phiếu** cắt rời phát cho các em.
- [x] Trang chi tiết học sinh: tổng sao, số lượt, lịch sử chơi (game, bài học, đúng/sai, sao, thời lượng); đổi tên, đặt lại mật khẩu, khoá/mở khoá. Chỉ xoá được em chưa chơi lượt nào.
- [x] Học sinh đăng nhập bằng username + mật khẩu (cookie `ng_student` riêng, mặc định 7 ngày — `STUDENT_SESSION_HOURS`). Guard toàn cục bảo vệ mọi `/api/play/*`. Đặt lại mật khẩu hoặc khoá tài khoản → em bị đăng xuất khỏi mọi máy.
- [x] Giới hạn đăng nhập tính theo **IP + tên đăng nhập** (5 lần/phút): cả lớp dùng chung mạng trường vẫn đăng nhập cùng lúc được.
- [x] `shared/`: `GameContent`, `GameResult`, `GameProps` (props chung của mọi game), schema bắt đầu/kết thúc lượt, `rateRound` (chấm sao).
- [x] API `play`: xem bài học chơi được của một game, bắt đầu lượt (máy chủ chọn và trộn từ, lưu danh sách từ đã phát), kết thúc lượt (chỉ nhận từ đã phát, chặn gửi 2 lần kể cả gửi đồng thời, lượt quá 3 giờ không nhận), lịch sử của em.
- [x] Logic sao (tính ở máy chủ): 3 sao ≥ 90% đúng, 2 sao ≥ 70%, 1 sao khi hoàn thành. Game không tính giờ: từ bỏ qua tính là sai. Game tính giờ: chỉ tính từ đã kịp trả lời.
- [x] Màn hình chung `/play/:slug`: chọn bài học → đếm ngược 3-2-1 → khung game → màn kết quả (sao, số đúng, từ sai kèm nghĩa/phiên âm/ví dụ + nút nghe). Header khu học sinh hiện số sao + nút thoát; trang `/me` là hồ sơ của em.
- [x] `usePronounce`: phát file audio, không có hoặc lỗi thì dùng `speechSynthesis`.
- [x] Game thử vòng lặp: **Word Quiz** (đọc từ → chọn nghĩa; sai lần đầu được gợi ý, sai lần hai hiện đáp án). Thêm game mới = thư mục `frontend/src/games/<slug>/` + một dòng trong `games/registry.ts`.

**Xong khi:** học sinh chơi hết một lượt, thấy sao, và admin thấy lượt chơi đó trong lịch sử của học sinh. → Test e2e `play.e2e-spec.ts` kiểm tra đúng luồng này, và đã thử tay trên trình duyệt.

### Giai đoạn 4 — MVP Games (≈ 4–5 tuần)

Theo thứ tự từ dễ đến khó; mỗi game là một thư mục `frontend/src/games/<slug>/`.

**Chuẩn bị ảnh + âm thanh (xong 26/11/2026)** — chốt mục 8.3 "Ảnh và âm thanh lấy từ đâu":

- [x] Ảnh: **Microsoft Fluent Emoji** (MIT, không cần key). Chỉ mục 1.595 emoji nằm sẵn trong `backend/src/media/fluent-emoji-index.ts` (tạo bằng `scripts/build-emoji-index.ts`, gắn với một commit cố định).
- [x] Ảnh thêm: **Pixabay** — chạy được cả khi **có** và **không có** key: có `PIXABAY_API_KEY` thì hiện thêm tab Pixabay (luôn `safesearch`, mặc định chỉ hình vẽ, lưu tạm kết quả 24 giờ theo điều khoản); không có thì chỉ dùng emoji, giao diện hướng dẫn cách bật.
- [x] Phát âm: **Free Dictionary API** cho IPA + câu ví dụ (chỉ nhận câu hoàn chỉnh, ngắn); file đọc lấy bản MP3 trên **Wikimedia Commons** (máy chủ file của dictionaryapi.dev chặn tải). Wikimedia giới hạn tải liên tiếp → tự chờ theo `Retry-After` và thử lại.
- [x] Trang giáo viên: nút **"Tìm ảnh"** và **"Lấy từ từ điển"** trong ô sửa từ vựng (chỉ điền ô đang trống, ghi nguồn âm thanh).
- [x] `npm run db:seed-media -w backend`: gắn ảnh (emoji chọn tay cho từng từ) + file đọc cho từ mẫu — 77/88 từ có ảnh (thiếu 8 chữ cái, family, desk, eraser), 72/88 có file đọc. Chạy lại an toàn.
- [x] An toàn: máy chủ chỉ nhận **mã ảnh** (không nhận URL), chỉ tải https từ đúng danh sách máy chủ cho phép, giới hạn dung lượng; ảnh đi qua cùng bước kiểm tra + đổi sang WebP như ảnh tự tải lên.

**Picture Match (xong 26/11/2026)** — `frontend/src/games/picture-match/`:

- [x] Cột hình bên trái, cột chữ bên phải; bấm hình rồi bấm chữ (hoặc ngược lại) để nối. Cặp nối đúng tô cùng màu **và** cùng số thứ tự (không chỉ dựa vào màu), đọc to từ, hiện nghĩa tiếng Việt + nút nghe lại.
- [x] Lượt chia thành nhiều màn đều nhau; cấp 1/2/3 = 3/4/5 cặp mỗi màn. Cấp 1–2 bấm vào chữ là nghe đọc; cấp 3 phải tự đọc. Từ trùng chữ hoặc trùng hình được xếp sang màn khác; thẻ chữ không bao giờ nằm thẳng hàng với hình của nó.
- [x] Nối đúng ngay lần đầu mới tính "đúng"; sai 3 lần với một hình thì hiện đáp án và khoá cặp đó. Ảnh lỗi thì hiện nghĩa tiếng Việt thay cho hình.
- [x] Âm hiệu ứng đúng/sai/hoàn thành dùng chung cho mọi game (`games/shared/sfx.ts`, tạo bằng Web Audio, không cần file) + nút tắt tiếng nhớ trên máy. Đã gắn thêm cho Word Quiz.
- [x] Seed: game ra đời sau bài học mẫu (`LATE_GAMES`) tự được gán các bài đã công khai nếu chưa có bài nào.
- [x] Đã chơi thử trọn lượt trên khổ máy tính bảng (820px) và điện thoại (390px).

**Missing Letters (xong 26/11/2026)** — `frontend/src/games/missing-letters/`:

- [x] Hiện hình (nếu có), nghĩa tiếng Việt, nút nghe đọc và từ với các ô trống. Em bấm chữ trên bàn phím của game **hoặc gõ bằng bàn phím thật**; chữ đúng rơi vào ô trống kế tiếp (trái sang phải), chữ sai rung lên.
- [x] Cấp 1/2/3 thiếu 1/2/3 chữ, bàn phím thêm 2/3/4 chữ nhiễu. Cấp 1–2 không che chữ đầu; cấp 1 tự đọc từ khi sang từ mới. Từ ngắn luôn chừa lại ít nhất một chữ; dấu cách, gạch nối không bao giờ bị che.
- [x] Điền hết mà không sai lần nào mới tính "đúng"; sai 3 lần thì hiện cả từ (ô thiếu tô đỏ).
- [x] Từ dài và cụm từ ("go to school") vừa màn hình 320px: ô trống giữ nguyên cỡ, chữ đã hiện co lại, cụm từ xuống dòng theo từng từ.
- [x] Tách phần chung của mọi game: `useGameRound` (ghi kết quả, đếm giờ, nộp đúng một lần), `GameHeader` (tiến độ, đồng hồ, nút tắt tiếng), `shuffle`. Word Quiz và Picture Match đã chuyển sang dùng.
- [x] Đã chơi thử trọn lượt ở cấp 1 (820px) và cấp 3 (390px, 320px); chơi lại Word Quiz và Picture Match sau khi tách phần chung.

**Word Builder (xong 26/11/2026)** — `frontend/src/games/word-builder/`:

- [x] Hiện hình (nếu có), nghĩa, nút nghe đọc, hàng ô trống và đống chữ đã trộn. Ba cách xếp: **chạm** chữ để đưa vào ô trống kế tiếp (chạm chữ trong ô để bỏ ra), **kéo thả** vào đúng ô (`@dnd-kit/core`; thả vào ô đã có chữ thì đổi chỗ, thả về đống chữ để bỏ ra), hoặc **gõ bàn phím thật** (Backspace bỏ chữ cuối).
- [x] Xếp kín thì tự kiểm tra: ô đúng được giữ lại (tô xanh), ô sai rung rồi trả chữ về. Chữ lặp đổi chỗ cho nhau vẫn tính đúng ("apple").
- [x] Cấp 1 cho sẵn chữ đầu (từ trên 2 chữ); cấp 2 không cho sẵn; cấp 3 thêm 2 chữ nhiễu. Không bao giờ trộn ra đúng thứ tự của từ.
- [x] Xếp đúng ngay lần đầu mới tính "đúng"; sai 3 lần thì hiện cả từ.
- [x] Vừa màn hình 320px kể cả từ 10 chữ ("watermelon") và cụm từ.
- [x] Đã chơi thử trọn lượt ở cấp 1 (820px) và cấp 3 (320px), dùng cả chạm, kéo thả và gõ phím.

**Picture Quiz (xong 26/11/2026)** — `frontend/src/games/picture-quiz/`:

- [x] Hiện một hình lớn, em chọn từ tiếng Anh đúng bằng cách bấm thẻ chữ **hoặc nhấn phím số 1–4**. Trả lời xong thì đọc to từ, hiện từ + nghĩa tiếng Việt + nút nghe lại, rồi tự sang câu sau.
- [x] Cấp 1 có 3 lựa chọn, cấp 2–3 có 4. Cấp 3 ưu tiên đáp án nhiễu **trông giống từ đúng** (cùng chữ đầu, chữ cuối, độ dài gần bằng: cat / car / cap). Không bao giờ lấy làm nhiễu một từ cũng đúng với hình: trùng chữ, dùng chung hình, hoặc cùng nghĩa (mum / mom).
- [x] Sai lần đầu: gợi ý kèm nút "Nghe gợi ý" (cấp 1 tự đọc luôn); sai lần hai thì hiện đáp án. Chọn đúng ngay lần đầu mới tính "đúng". Ảnh lỗi thì hiện nghĩa tiếng Việt thay cho hình.
- [x] Dòng đáp án luôn được giữ chỗ nên các nút không bị đẩy xuống khi hiện đáp án. Seed: thêm vào `LATE_GAMES`.
- [x] Đã chơi thử trọn lượt ở cấp 1 (820px) và cấp 3 (320px), dùng cả chạm và phím số.

**Word Runner (xong 26/11/2026)** — `frontend/src/games/word-runner/`, game đầu tiên dùng **Phaser 4**:

- [x] Bạn nhỏ chạy, chướng ngại vật (thùng, đá, cọc) mang biển chữ chạy tới. Em gõ đúng cả từ trước khi nó tới nơi thì biển chữ bay lên và bạn nhỏ tự nhảy qua (canh để chướng ngại vật đi qua đúng lúc lên cao nhất); không kịp thì vấp. Mọi hình vẽ bằng code, không cần file ảnh.
- [x] Phaser chỉ lo phần chạy (`RunnerScene`); gõ phím và chấm điểm ở React. Phím nhận qua một ô gõ ẩn nên dùng được cả bàn phím thật lẫn bàn phím ảo. Bấm ra ngoài thì game tạm dừng ("Bấm vào đây để chạy tiếp"), không vấp oan.
- [x] Dưới khung chạy hiện nghĩa tiếng Việt và từ cần gõ, tô xanh phần đã gõ, đánh dấu chữ kế tiếp; gõ sai thì chữ và biển rung. Không phân biệt hoa thường; cụm từ phải gõ dấu cách, gạch nối và dấu nháy tự điền; phím Shift, dấu chấm… không tính sai.
- [x] Thời gian mỗi từ = thời gian đọc + thêm cho mỗi chữ; cấp 1/2/3 nhanh dần. Cấp 1 đọc to từ khi nó xuất hiện; gõ xong thì đọc to ở mọi cấp. Gõ xong thì chướng ngại vật lao tới nhanh hơn để em không phải chờ.
- [x] Gõ kịp mà không sai phím nào mới tính "đúng". Game tính giờ (mặc định 90 giây): chơi tới khi hết giờ hoặc hết từ.
- [x] Màn chọn bài của game gõ phím nhắc "Trò này cần bàn phím" khi máy chỉ có màn cảm ứng.
- [x] Đã chơi thử trọn lượt ở cấp 1 (820px) và cấp 3 (390px): gõ đúng, gõ sai, để vấp, bấm ra ngoài để tạm dừng.

| # | Game | Công nghệ | Cần dữ liệu | Ước lượng |
|---|---|---|---|---|
| 1 | Picture Match ✅ | React + CSS | ảnh | 1 tuần |
| 2 | Missing Letters ✅ | React | — | 0,5 tuần |
| 3 | Word Builder ✅ | React + kéo thả (`dnd-kit`) | — | 1 tuần |
| 4 | Picture Quiz ✅ | React | ảnh (+ audio) | 0,5 tuần |
| 5 | Word Runner ✅ | Phaser 4 | — | 1,5–2 tuần |

Cho mỗi game:
- [x] Logic game tách khỏi giao diện, có unit test (vd: tạo đáp án nhiễu, kiểm tra đúng/sai).
- [x] Hỗ trợ 3 cấp độ (vd: Missing Letters cấp 1 thiếu 1 chữ, cấp 3 thiếu 3 chữ).
- [x] Âm thanh hiệu ứng đúng/sai, có nút tắt tiếng.
- [x] Chạy tốt trên máy tính bảng (game typing: máy chỉ có màn cảm ứng thì được nhắc cần bàn phím).

**Xong khi (= MVP):** 5 game trên đều đọc từ kho chung, lưu kết quả, cho sao. Sửa nghĩa của 1 từ trong Admin → lượt chơi tiếp theo thấy ngay. ✅ (26/11/2026) — Test e2e trong `play.e2e-spec.ts` kiểm tra luồng này qua API: sửa nghĩa + phiên âm → lượt mới nhận bản mới, màn ôn lại từ sai cũng vậy. Đã thử tay: sửa "monkey" bằng form Admin, học sinh mở Word Quiz thấy ngay nghĩa mới. Máy chủ đọc từ thẳng từ database mỗi lần bắt đầu lượt, không có cache.

👉 **Mốc phát hành thử:** triển khai MVP lên mạng và cho một nhóm nhỏ học sinh chơi thử, thu phản hồi trước khi làm tiếp.

### Giai đoạn 5 — Thành tích + Thống kê (≈ 2–3 tuần)

- [ ] Điểm thưởng, huy hiệu (rule chạy sau mỗi lượt chơi), trang "Thành tích của em", hiệu ứng mở khóa huy hiệu.
- [ ] Admin → Học sinh: danh sách, chi tiết, lịch sử chơi, tiến độ theo chủ đề.
- [ ] Admin → Thống kê: tổng học sinh, lượt chơi theo game, tỉ lệ đúng/sai, **top từ hay sai**, tiến bộ theo tuần.

**Xong khi:** giáo viên trả lời được "tuần này lớp hay sai từ nào nhất?" chỉ bằng Dashboard.

### Giai đoạn 6 — Mở rộng (liên tục)

- [ ] Game typing: Word Catcher (Phaser), Typing Speed Test (WPM + độ chính xác), Spell Master (nghe → gõ).
- [ ] Multiplayer: Socket.IO gateway, phòng chơi bằng mã 4 số (không có chat công khai), Word Battle → Vocabulary Duel → Typing Race. Server là nơi chấm điểm, client chỉ gửi đáp án.
- [ ] Fun Learning: Color World, Math Rush, Little Chef, Pet Care, My Little House (cần thêm loại nội dung ngoài từ vựng — thiết kế riêng khi đến lượt).

---

## 5. Triển khai (Deployment)

| Thành phần | Gợi ý |
|---|---|
| Frontend | Vercel / Netlify / Cloudflare Pages |
| Backend | Render / Railway / VPS + Docker |
| Database | PostgreSQL managed (Neon, Supabase, Railway) |
| Media | Cloudflare R2 (rẻ, không tính phí băng thông) |

- [ ] Môi trường `staging` và `production` tách riêng.
- [ ] Sao lưu database tự động hằng ngày.
- [ ] HTTPS, CORS chỉ cho domain frontend, cookie `Secure` + `SameSite`.

---

## 6. An toàn cho trẻ em & bảo mật (áp dụng xuyên suốt)

- Học sinh chỉ có tên hiển thị + username; không thu email, ngày sinh, ảnh thật.
- Không có chat hay hồ sơ công khai; bảng xếp hạng (nếu có) chỉ hiện tên hiển thị.
- Mọi quyền admin kiểm tra ở **backend** (guard), không chỉ ẩn nút ở frontend.
- Kiểm tra đầu vào (DTO + `class-validator`), giới hạn loại và dung lượng file upload.
- Mật khẩu hash bằng bcrypt/argon2; rate-limit đăng nhập.

---

## 7. Tổng thời gian ước lượng

| Giai đoạn | Thời gian | Cộng dồn |
|---|---|---|
| 0. Khởi tạo | 1 tuần | 1 |
| 1. Nền tảng + auth | 2 tuần | 3 |
| 2. Quản trị nội dung | 3 tuần | 6 |
| 3. Học sinh + vòng lặp chơi | 2 tuần | 8 |
| 4. MVP Games | 4–5 tuần | ~13 |
| 5. Thành tích + thống kê | 2–3 tuần | ~16 |
| 6. Mở rộng | liên tục | — |

→ **MVP sau khoảng 3 tháng**, bản đầy đủ có thống kê sau khoảng 4 tháng (theo giả định 10–15 giờ/tuần).

---

## 8. Những điểm cần chốt

1. Làm một mình hay theo nhóm? (Nhóm thì có thể làm Giai đoạn 2 và 3 song song.)
2. Học sinh đăng nhập bằng gì: username + mật khẩu, hay mã lớp + chọn tên/avatar (dễ hơn cho trẻ nhỏ)?
3. Ảnh và âm thanh lấy từ đâu: giáo viên tự tải lên, hay dùng nguồn miễn phí bản quyền (vd: Openmoji, Freesound)?
4. Có mục tiêu ngày ra mắt cụ thể không (vd: đầu năm học)?
