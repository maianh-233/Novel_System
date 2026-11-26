# 🎮 Novel Game

### Play, Learn & Grow!

**Novel Game** là nền tảng trò chơi giáo dục trực tuyến dành cho học sinh tiểu học, kết hợp giữa giải trí và học tập thông qua các mini-game tương tác.

Thay vì tiếp cận tiếng Anh thông qua những bài tập truyền thống, học sinh có thể học từ vựng, luyện đánh máy, rèn luyện chính tả và khám phá kiến thức thông qua những trò chơi thú vị.

Đặc biệt, Novel Game tích hợp hệ thống quản trị nội dung riêng, cho phép giáo viên chủ động bổ sung và quản lý kho từ vựng, giúp nội dung học tập luôn được cập nhật mà không cần chỉnh sửa mã nguồn của từng trò chơi.

---

## 🌈 1. Project Overview

Novel Game được xây dựng theo mô hình Multi-Game Educational Platform – nền tảng tập hợp nhiều mini-game giáo dục trên cùng một hệ thống.

Hệ thống được chia thành **hai khu vực sử dụng chính**:

| Khu vực | Đối tượng sử dụng | Mục đích |
|---|---|---|
| Admin Dashboard | Một giáo viên quản trị duy nhất | Quản lý từ vựng, chủ đề, nội dung trò chơi và dữ liệu học tập. |
| Student Platform | Học sinh tiểu học | Tham gia mini-game, học tiếng Anh và theo dõi thành tích. |

### 🎯 Project Goals

- **Learn English:** Giúp học sinh làm quen với từ vựng và câu tiếng Anh cơ bản.
- **Improve Typing Skills:** Rèn luyện kỹ năng sử dụng bàn phím thông qua các trò chơi gõ chữ.
- **Learn Through Games:** Biến việc học tập thành hoạt động giải trí thú vị.
- **Interactive Learning:** Khuyến khích học sinh chủ động khám phá và luyện tập.
- **Content Flexibility:** Cho phép giáo viên tự cập nhật nội dung học tập thông qua hệ thống quản trị.

---

# 👩‍🏫 2. Admin Dashboard – Teacher Management

Đây là khu vực quản trị dành riêng cho **một tài khoản duy nhất của giáo viên tiếng Anh**.

Giáo viên có toàn quyền quản lý nội dung và dữ liệu trên nền tảng. Không hỗ trợ đăng ký thêm tài khoản quản trị hoặc phân quyền nhiều giáo viên trong phạm vi phiên bản hiện tại.

### 2.1. Admin Authentication

- Đăng nhập bằng tài khoản quản trị được thiết lập sẵn.
- Đăng xuất khỏi hệ thống.
- Thay đổi mật khẩu.
- Bảo vệ các trang quản trị bằng cơ chế xác thực và phân quyền.

### 2.2. Vocabulary Management – Quản lý từ vựng

Giáo viên có thể chủ động quản lý kho từ vựng tiếng Anh.

- Thêm từ vựng mới.
- Chỉnh sửa thông tin từ vựng.
- Xóa hoặc ngừng sử dụng từ vựng.
- Quản lý nghĩa tiếng Việt.
- Thêm phiên âm IPA.
- Thêm hình ảnh minh họa.
- Tích hợp file âm thanh phát âm.
- Thêm câu ví dụ.
- Phân loại từ vựng theo chủ đề và cấp độ.

### 2.3. Category Management – Quản lý chủ đề

- Tạo chủ đề học tập mới.
- Chỉnh sửa thông tin chủ đề.
- Xóa hoặc ẩn chủ đề không còn sử dụng.
- Quản lý các từ vựng thuộc từng chủ đề.

Các chủ đề dự kiến:

- Alphabet
- Animals
- Fruits
- Colors
- Numbers
- Food & Drinks
- Family
- School Objects
- Daily Activities

### 2.4. Learning Content Management – Quản lý nội dung học tập

- Tạo bộ từ vựng theo từng bài học.
- Kết hợp nhiều chủ đề trong một bộ từ vựng.
- Lựa chọn từ vựng được sử dụng trong từng mini-game.
- Thiết lập cấp độ và độ khó.
- Cập nhật nội dung mà không cần thay đổi source code của mini-game.

### 2.5. Student Management – Quản lý học sinh

- Xem danh sách học sinh.
- Xem thông tin tài khoản học sinh.
- Theo dõi lịch sử tham gia trò chơi.
- Xem kết quả học tập của từng học sinh.
- Theo dõi tiến độ luyện tập.

### 2.6. Learning Analytics – Thống kê học tập

- Tổng số học sinh tham gia.
- Số lượt chơi của từng mini-game.
- Thống kê kết quả đúng và sai.
- Theo dõi số từ vựng học sinh đã luyện tập.
- Xem kết quả theo từng chủ đề.
- Theo dõi sự tiến bộ của học sinh.

---

# 🧒 3. Student Platform – Learning & Gaming

Đây là khu vực dành cho học sinh tiểu học.

Giao diện được thiết kế đơn giản, sinh động, nhiều hình ảnh minh họa và dễ sử dụng. Học sinh có thể lựa chọn trò chơi yêu thích và bắt đầu học tập thông qua các thử thách.

### 3.1. Student Access

- Truy cập khu vực trò chơi.
- Đăng nhập bằng tài khoản học sinh nếu được cấp.
- Xem hồ sơ và thành tích cá nhân.
- Đăng xuất khỏi hệ thống.

### 3.2. Game Library – Thư viện trò chơi

Hiển thị các mini-game được phân loại theo nhóm:

#### ⌨️ Typing Games – Luyện kỹ năng đánh máy

| Game | Description |
|---|---|
| Word Runner | Gõ từ tiếng Anh để giúp nhân vật vượt qua chướng ngại vật. |
| Word Catcher | Gõ các từ xuất hiện trên màn hình trước khi chúng biến mất. |
| Typing Race | Thi đấu tốc độ đánh máy với người chơi khác. |
| Typing Speed Test | Luyện tốc độ và độ chính xác khi đánh máy. |

#### 📚 Vocabulary Games – Học từ vựng

| Game | Description |
|---|---|
| Picture Match | Ghép hình ảnh với từ tiếng Anh tương ứng. |
| Missing Letters | Điền chữ cái còn thiếu để hoàn thành từ. |
| Word Builder | Sắp xếp các chữ cái thành từ tiếng Anh hoàn chỉnh. |
| Picture Quiz | Nhận diện hình ảnh và chọn từ tiếng Anh chính xác. |
| Spell Master | Nghe phát âm và nhập từ tiếng Anh tương ứng. |

#### ⚔️ English Battle – Thi đấu tiếng Anh

| Game | Description |
|---|---|
| Word Battle | Hai học sinh thi gõ từ tiếng Anh, người có nhiều từ đúng hơn sẽ chiến thắng. |
| Vocabulary Duel | Hai học sinh thi nhận diện và lựa chọn từ vựng chính xác. |

#### 🎨 Fun Learning – Học tập qua trải nghiệm

| Game | Description |
|---|---|
| Little Chef | Học từ vựng thực phẩm thông qua trò chơi nấu ăn. |
| Pet Care | Chăm sóc thú cưng và làm quen với từ tiếng Anh. |
| My Little House | Học tên đồ vật và vị trí thông qua trò chơi sắp xếp căn phòng. |
| Math Rush | Giải các phép toán đơn giản. |
| Color World | Nhận diện màu sắc và học tên màu bằng tiếng Anh. |

*Danh sách trò chơi sẽ được mở rộng trong quá trình phát triển.*

### 3.3. Learning Experience – Trải nghiệm học tập

- Học từ vựng theo từng chủ đề.
- Luyện tập theo cấp độ từ dễ đến khó.
- Xem hình ảnh minh họa.
- Nghe cách phát âm tiếng Anh.
- Nhận gợi ý khi trả lời sai.
- Xem kết quả sau mỗi lượt chơi.

### 3.4. Rewards & Achievements – Thành tích

- Nhận sao khi hoàn thành thử thách.
- Tích lũy điểm thưởng.
- Mở khóa huy hiệu.
- Theo dõi thành tích cá nhân.
- Khuyến khích học sinh tiếp tục luyện tập.

---

## 🧩 4. Shared Vocabulary System

Một trong những chức năng quan trọng nhất của Novel Game là hệ thống kho từ vựng dùng chung.

Giáo viên chỉ cần thêm từ vựng một lần trong Admin Dashboard. Các mini-game có thể sử dụng lại dữ liệu này mà không cần tạo bộ từ vựng riêng cho từng trò chơi.

### Vocabulary Data

| Field | Description |
|---|---|
| word | Từ tiếng Anh |
| meaning | Nghĩa tiếng Việt |
| pronunciation | Phiên âm IPA |
| image | Hình ảnh minh họa |
| audio | Âm thanh phát âm |
| example | Câu ví dụ |
| category | Chủ đề |
| level | Cấp độ |
| status | Trạng thái sử dụng |

### Example Workflow

1. Giáo viên đăng nhập Admin Dashboard.
2. Thêm từ vựng mới: `Butterfly`.
3. Nhập nghĩa tiếng Việt: `Con bướm`.
4. Chọn chủ đề: `Animals`.
5. Thêm hình ảnh và âm thanh phát âm.
6. Lưu dữ liệu vào kho từ vựng.
7. Hệ thống cập nhật nội dung cho các mini-game sử dụng bộ từ vựng Animals.

Ví dụ, từ `Butterfly` có thể xuất hiện trong:

- Picture Match.
- Missing Letters.
- Word Builder.
- Word Runner.
- Picture Quiz.

**Mục tiêu:** Giáo viên chủ động cập nhật nội dung học tập mà không cần can thiệp vào mã nguồn của từng mini-game.

---

## 🛠️ 5. Technology Stack

Công nghệ dự kiến sử dụng:

| Component | Technology |
|---|---|
| Frontend | ReactJS, TypeScript |
| Styling | HTML, CSS, Tailwind CSS |
| Game Development | Phaser 3, SVG, CSS Animation |
| Backend | Node.js, NestJS |
| Real-time Communication | Socket.IO, WebSocket |
| Database | PostgreSQL |
| Authentication | JWT / Session |
| Version Control | Git, GitHub |

Công nghệ có thể được điều chỉnh trong quá trình triển khai.

---

## 📁 6. Project Structure

Dự kiến tổ chức source code theo hướng module-based:

```text
novel-game/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   └── student/
│   │   ├── games/
│   │   │   ├── word-runner/
│   │   │   ├── word-catcher/
│   │   │   ├── word-battle/
│   │   │   ├── picture-match/
│   │   │   └── word-builder/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── admin/
│   │   │   ├── students/
│   │   │   ├── vocabulary/
│   │   │   ├── categories/
│   │   │   ├── games/
│   │   │   ├── learning/
│   │   │   └── achievements/
│   │   ├── common/
│   │   └── main.ts
│   └── package.json
│
├── docs/
│
└── README.md
```

---

## 🚀 Chạy dự án (Getting Started)

Yêu cầu: Node.js ≥ 22, Docker Desktop.

```bash
npm install                          # cài toàn bộ (frontend, backend, shared)
cp backend/.env.example backend/.env # rồi đổi ADMIN_PASSWORD
npm run db:up                        # bật PostgreSQL trong Docker (cổng 55432)
npm run db:migrate                   # tạo bảng
npm run db:seed                      # tạo tài khoản giáo viên + chủ đề + từ mẫu
npm run db:seed-media -w backend     # (cần internet) gắn hình + file phát âm cho từ mẫu
npm run dev                          # frontend http://localhost:5173 · API http://localhost:3000/api
```

| Lệnh | Việc làm |
|---|---|
| `npm run typecheck` / `npm run lint` / `npm test` | Kiểm tra kiểu, lint, unit test |
| `npm run test:e2e -w backend` | Test e2e (cần database đang chạy) |
| `npm run db:studio -w backend` | Mở Prisma Studio để xem dữ liệu |
| `npm run build` | Build cả 3 workspace |

Kế hoạch chi tiết từng giai đoạn: [docs/PLAN.md](docs/PLAN.md).

---

### Nguồn ảnh & âm thanh miễn phí

| Nguồn | Dùng cho | Giấy phép | Cần đăng ký? |
|---|---|---|---|
| [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) | Hình minh hoạ (nút "Tìm ảnh", ảnh cho từ mẫu) | MIT | Không |
| [Pixabay](https://pixabay.com/api/docs/) | Ảnh thêm khi emoji không có (luôn bật lọc an toàn) | Pixabay Content License — không cần ghi nguồn | Có — đặt `PIXABAY_API_KEY` trong `backend/.env`; để trống thì chỉ dùng emoji |
| [Free Dictionary API](https://dictionaryapi.dev) + [Wikimedia Commons](https://commons.wikimedia.org) | Phiên âm IPA, câu ví dụ, file đọc của người thật (nút "Lấy từ từ điển") | File đọc: CC BY / CC BY-SA (ghi nguồn hiện ngay khi lấy) | Không |

Mọi ảnh/âm thanh chọn dùng đều được tải về máy chủ; trang học sinh không gọi ra trang ngoài và các dịch vụ trên chỉ nhận chữ tiếng Anh cần tra, không bao giờ nhận thông tin học sinh. Từ nào thiếu file đọc thì trình duyệt tự đọc.

---

## 🗺️ 7. Development Roadmap

### Phase 1 – Platform Foundation

- [ ] Thiết kế giao diện Student Platform.
- [ ] Thiết kế giao diện Admin Dashboard.
- [ ] Xây dựng hệ thống điều hướng.
- [ ] Xây dựng xác thực tài khoản quản trị.
- [ ] Thiết lập cơ sở dữ liệu.

### Phase 2 – Admin Management

- [ ] Quản lý kho từ vựng.
- [ ] Quản lý chủ đề.
- [ ] Quản lý hình ảnh và âm thanh.
- [ ] Quản lý bộ từ vựng theo bài học.
- [ ] Cấu hình nội dung cho mini-game.

### Phase 3 – Mini Games Development

- [ ] Phát triển Picture Match.
- [ ] Phát triển Missing Letters.
- [ ] Phát triển Word Builder.
- [ ] Phát triển Word Runner.
- [ ] Phát triển Word Battle.

### Phase 4 – Student Learning System

- [ ] Xây dựng tài khoản học sinh.
- [ ] Lưu lịch sử trò chơi.
- [ ] Theo dõi kết quả học tập.
- [ ] Xây dựng hệ thống sao và huy hiệu.
- [ ] Tích hợp âm thanh phát âm.

### Phase 5 – Expansion

- [ ] Bổ sung mini-game mới.
- [ ] Phát triển tính năng multiplayer.
- [ ] Hoàn thiện thống kê học tập.
- [ ] Tối ưu trải nghiệm người dùng.
- [ ] Kiểm thử và triển khai hệ thống.

---

## 🔒 8. Child-Friendly Design & Security

Novel Game được thiết kế dành cho học sinh tiểu học, vì vậy hệ thống ưu tiên:

- Giao diện thân thiện, trực quan và dễ sử dụng.
- Nội dung phù hợp với lứa tuổi.
- Không yêu cầu học sinh cung cấp thông tin cá nhân không cần thiết.
- Không hiển thị thông tin hoặc vai trò quản trị cho học sinh.
- Bảo vệ khu vực Admin bằng xác thực và phân quyền phía Backend.
- Hạn chế tương tác công khai không cần thiết.
- Bảo vệ dữ liệu học tập của học sinh.

---

## 💡 9. Future Vision

Novel Game hướng đến việc xây dựng một môi trường học tập tương tác, nơi học sinh có thể vừa giải trí vừa tiếp thu kiến thức thông qua các trò chơi.

Đồng thời, nền tảng giúp giáo viên chủ động xây dựng và cập nhật nội dung học tập, tạo ra những trải nghiệm phù hợp với nhu cầu giảng dạy.

**Play, Learn & Grow – Every game is a new adventure!**

---

*Novel Game is a personal educational gaming project designed to make learning English more enjoyable for primary school students.*