# 🎓 Kế hoạch mở rộng cho học sinh cấp 2 (lớp 6–9)

Tài liệu này nối tiếp [PLAN.md](PLAN.md). MVP hiện tại (5 game từ vựng + vòng lặp chơi + quản trị nội dung) được làm cho **tiểu học**. Phần này thêm **cấp 2**, và vẫn giữ nguyên phần tiểu học.

> Giả định như PLAN.md: 1 người làm, 10–15 giờ/tuần.

---

## 0. Những điều đã chốt

| Câu hỏi | Trả lời |
|---|---|
| Phục vụ ai? | **Cả hai**: tiểu học (như hiện tại) và cấp 2. Mỗi lớp thuộc một cấp học. |
| Bám sách giáo khoa nào? | **Không bám sách.** Giáo viên tự soạn "Unit" (bài học) gồm từ vựng + câu hỏi. |
| Mục tiêu | Ôn từ vựng theo Unit · Ngữ pháp + các dạng bài kiểm tra · Ôn thi vào lớp 10 · Giao bài tập về nhà · Luyện đề. |
| Ai được thi / luyện đề? | **Mọi học sinh của giáo viên có tài khoản chưa bị khoá.** Không cần đăng ký hay xếp lớp thêm. |
| Độ khó | **Khác nhau theo cấp học**: cùng một game, cấp 2 khó hơn tiểu học (xem mục 3). |
| Thiết bị | **Cả hai**: máy tính ở phòng máy trên lớp, điện thoại ở nhà. Mọi tính năng cấp 2 phải dùng tốt trên điện thoại. |

---

## 1. Nguyên tắc

1. **Câu hỏi là trái tim thứ hai.** Từ vựng vẫn là kho chung. Thêm một **ngân hàng câu hỏi** dùng chung cho game ngữ pháp, bài tập và đề thi. Không game nào hard-code câu hỏi.
2. **Thi thì chấm ở máy chủ.** Game hiện tại chấm ở máy học sinh rồi gửi kết quả; với đề thi thì không được làm vậy. Đáp án không bao giờ gửi xuống máy học sinh trước khi nộp bài.
3. **Cấp học là một "chế độ", không phải một ứng dụng khác.** Cùng code, cùng game. Cấp học quyết định độ khó, giao diện và game nào hiện ra.
4. **Nhập liệu phải nhanh.** Không bám sách thì giáo viên tự nhập hàng trăm câu. Dán từ Word/Google Docs theo một định dạng đơn giản quan trọng hơn mọi form đẹp.
5. **An toàn trẻ em giữ nguyên** (PLAN.md mục 6): học sinh cấp 2 vẫn là trẻ vị thành niên. Không email, không chat, bảng xếp hạng chỉ hiện tên hiển thị và giáo viên có thể tắt.

---

## 2. Mô hình dữ liệu cần thêm / sửa

| Bảng | Trường chính | Ghi chú |
|---|---|---|
| `ClassGroup` (mới) | id, name (`7A`), stage (`primary`/`secondary`), grade (1–9), isArchived | Giáo viên tạo lớp. Cuối năm lưu trữ lớp cũ, không xoá. |
| `Student` (sửa) | + classId | Cấp học và khối của em lấy theo lớp. Em chưa xếp lớp thì coi là tiểu học như hiện tại. |
| `Lesson` (sửa) | + stage, + grade (tuỳ chọn) | "Unit" của cấp 2 chính là Lesson, có thêm câu hỏi. |
| `Question` (mới) | id, type, prompt, options (JSON), answers (JSON: các đáp án chấp nhận), explanation, grammarTag, level (1–3), stage, passageId?, status | Xem các dạng ở mục 4. "Xoá" = ngừng dùng (giống Vocabulary) để không hỏng lịch sử. |
| `Passage` (mới) | id, title, text, audioUrl? | Đoạn văn cho bài đọc hiểu / điền từ vào đoạn; nhiều câu hỏi dùng chung một đoạn. |
| `LessonQuestion` (mới) | lessonId, questionId, order | Unit gồm cả từ vựng lẫn câu hỏi. |
| `Exam` (mới) | id, title, stage, grade?, durationMin, mode (`practice`/`exam`), opensAt?, closesAt?, maxAttempts, showResult (`after_submit`/`after_close`), shuffle, isPublished | Đề thi / đề luyện. |
| `ExamSection` / `ExamItem` (mới) | examId, title, order · sectionId, questionId, points | Đề chia phần như đề thật (Phát âm, Ngữ pháp, Đọc hiểu, Viết lại câu…). |
| `ExamAttempt` (mới) | id, examId, studentId, startedAt, deadlineAt, submittedAt?, score?, order (JSON: thứ tự câu/đáp án đã trộn) | Mỗi lần làm bài. |
| `ExamAnswer` (mới) | attemptId, questionId, response (JSON), correct?, points? | Lưu ngay mỗi khi em chọn/gõ (tự lưu). |
| `Assignment` (mới) | id, title, target (lớp nào / tất cả), kind (`lesson_game` / `exam`), lessonId?, gameSlug?, examId?, dueAt, minStars? | Bài tập về nhà. |

`PlaySession` không đổi. Tiến độ bài tập được tính từ các lượt chơi và bài thi đã có, không cần lưu thêm.

---

## 3. Độ khó theo cấp học

Hiện tại mỗi game có cấp 1–3 (lấy theo bài học). Thêm **cấp học** vào nội dung game (`GameContent.stage`). Mỗi game tự khai báo bộ độ khó cho từng cấp học:

| Game | Tiểu học (như hiện tại) | Cấp 2 |
|---|---|---|
| Word Quiz | Đọc từ → chọn nghĩa | Thêm chiều Việt → Anh; cấp 3 dùng định nghĩa tiếng Anh thay cho nghĩa tiếng Việt |
| Missing Letters | Thiếu 1–3 chữ, có hình | Thiếu nhiều chữ hơn (cả chữ đầu), không có hình, có cụm từ |
| Word Builder | Từ ngắn, ít chữ nhiễu | Từ dài, nhiều chữ nhiễu; cấp 3 xếp **từ thành câu** |
| Picture Quiz / Picture Match | Giữ nguyên | Chỉ hiện ở lớp 6 (từ vựng cụ thể có hình) |
| Word Runner | Chậm, đọc to từ | Nhanh hơn, có cụm từ / collocation, không đọc to |

Giao diện: giữ giao diện "dán sticker" cho tiểu học. Cấp 2 dùng **chủ đề trưởng thành hơn**: ít màu và icon trẻ con, chữ gọn, bố cục giống ứng dụng học tập. Làm bằng design token theo cấp học, không viết lại component. Các game "Fun Learning" (Pet Care, Little Chef…) chỉ hiện cho tiểu học.

---

## 4. Các dạng câu hỏi (theo dạng bài kiểm tra thường gặp)

| Dạng | Học sinh làm gì | Cách chấm tự động |
|---|---|---|
| Trắc nghiệm A/B/C/D | Chọn đáp án đúng (ngữ pháp, từ vựng, giao tiếp, biển báo) | So khớp lựa chọn |
| Phát âm | Chọn từ có phần gạch chân phát âm khác | So khớp lựa chọn (prompt lưu vị trí gạch chân) |
| Trọng âm | Chọn từ có trọng âm khác | So khớp lựa chọn |
| Chia động từ | Gõ dạng đúng của động từ trong ngoặc | So với danh sách đáp án chấp nhận |
| Word form | Gõ dạng đúng của từ trong ngoặc | So với danh sách đáp án chấp nhận |
| Tìm lỗi sai | Bấm vào phần sai trong câu (A/B/C/D) | So khớp lựa chọn |
| Sắp xếp câu | Kéo thả các cụm từ thành câu đúng | So với các thứ tự chấp nhận (dùng lại kéo thả của Word Builder) |
| Viết lại câu | Gõ câu mới cùng nghĩa (có từ gợi ý) | So với **nhiều** đáp án chấp nhận, sau khi chuẩn hoá |
| Điền từ vào đoạn văn | Chọn/gõ từ cho từng chỗ trống trong `Passage` | Từng chỗ trống chấm như trắc nghiệm / gõ |
| Đọc hiểu | Đọc `Passage`, trả lời Đúng/Sai hoặc A/B/C/D | So khớp lựa chọn |
| Nghe (sau) | Nghe audio của `Passage`, trả lời | So khớp lựa chọn |

**Chuẩn hoá câu gõ** (một hàm dùng chung, có unit test): bỏ hoa thường và khoảng trắng thừa, quy dấu nháy cong về nháy thẳng, bỏ dấu chấm cuối câu. Không chấm điểm từng phần, không chấm bài viết tự do: những phần đó cần giáo viên chấm tay, để sau.

**Nhập câu hỏi:**

- Form từng câu theo dạng (có xem trước như học sinh thấy).
- **Dán văn bản** theo định dạng quen thuộc của đề Word. Máy kiểm tra trước, báo lỗi theo số dòng, có lỗi thì không ghi câu nào (giống nhập CSV từ vựng hiện có):
  ```text
  1. She ___ to school every day.
  A. go   B. goes   C. going   D. gone
  Đáp án: B
  Giải thích: Hiện tại đơn, chủ ngữ số ít → động từ thêm -s/-es.
  ```
- CSV cho số lượng lớn.

---

## 5. Lộ trình

Mỗi giai đoạn có **"Xong khi"** như PLAN.md. Thứ tự: làm cái rẻ trước để các em cấp 2 chơi được sớm, rồi mới tới ngân hàng câu hỏi và luyện đề.

### C0 — Lớp và cấp học (≈ 1,5 tuần)

- [x] `ClassGroup`: giáo viên tạo lớp (tên, khối 1–9), xếp học sinh vào lớp (chọn nhiều em một lúc), lưu trữ lớp cuối năm.
- [x] Tạo tài khoản theo lô (đã có) cho phép chọn lớp ngay.
- [x] `Lesson.stage` + `grade`; trang chọn bài của học sinh chỉ hiện bài đúng cấp học.
- [x] `GameContent.stage`; 5 game hiện có đọc cấp học và áp bộ độ khó cấp 2 (mục 3). Có unit test cho từng bộ độ khó.
- [x] Chủ đề giao diện cấp 2; ẩn game chỉ dành cho tiểu học.

**Xong khi:** một em lớp 7 đăng nhập, thấy giao diện cấp 2, chơi Word Runner nhanh hơn em lớp 3 trên cùng một bài học. Em tiểu học không thấy gì thay đổi.

👉 **Mốc dùng thử cấp 2:** cho một lớp cấp 2 chơi các game từ vựng trong khi làm C1–C2.

### C1 — Ngân hàng câu hỏi (≈ 3 tuần)

- [x] Bảng `Question`, `Passage`, `LessonQuestion`; schema Zod dùng chung trong `@novel/shared`.
- [x] Thư viện chấm điểm thuần (`shared/`), có unit test cho từng dạng ở mục 4, gồm cả chuẩn hoá câu gõ. Máy chủ và màn xem trước của giáo viên dùng chung thư viện này.
- [x] Admin → Câu hỏi: tìm, lọc theo dạng / điểm ngữ pháp / cấp học / cấp độ, form theo dạng, xem trước, ngừng dùng.
- [x] Nhập bằng dán văn bản và CSV, kiểm tra trước, báo lỗi theo dòng.
- [x] Gắn câu hỏi vào Unit (Lesson).

**Xong khi:** giáo viên dán 20 câu trắc nghiệm + 10 câu word form từ Word vào hệ thống trong dưới 5 phút, và xem trước đúng như học sinh sẽ thấy.

### C2 — Luyện đề và thi (≈ 3 tuần)

- [x] Admin → Đề thi: tạo đề theo phần, chọn câu từ ngân hàng, đặt điểm, thời gian, chế độ (luyện tập / thi), giờ mở–đóng, số lần làm, trộn câu và đáp án, khi nào cho xem kết quả.
- [x] **Quyền vào thi:** mọi học sinh có tài khoản đang hoạt động (`isActive`), trong giờ mở của đề, còn lượt làm. Bị khoá giữa chừng thì không nộp được nữa.
- [x] Màn làm bài (ưu tiên điện thoại): một câu mỗi màn hoặc cuộn cả phần, đánh dấu "xem lại", bảng điều hướng câu, đồng hồ.
- [x] **Tự lưu** từng câu lên máy chủ: mất mạng hay tắt máy thì vào lại làm tiếp, không mất bài. Máy chủ giữ hạn nộp (`deadlineAt`, cho thêm 30 giây do mạng); quá hạn thì tự nộp những gì đã lưu.
- [x] Máy chủ chấm điểm, quy về **thang 10**. Màn kết quả: điểm, từng câu đúng/sai, đáp án và giải thích (theo cài đặt `showResult`).
- [x] Admin → Kết quả đề: bảng điểm theo lớp, tỉ lệ đúng từng câu, **dạng bài / điểm ngữ pháp hay sai nhất**, xuất CSV.

**Xong khi:** cả lớp làm một đề 40 phút trên điện thoại và máy tính. Một em tắt máy giữa chừng vẫn vào làm tiếp được. Giáo viên xem được bảng điểm và câu cả lớp hay sai ngay sau giờ đóng đề. → Có test e2e cho luồng nộp bài, quá hạn và tài khoản bị khoá.

### C3 — Giao bài tập về nhà (≈ 2 tuần)

- [x] Admin → Bài tập: giao một Unit + game (vd: "Unit 3 – Word Builder, tối thiểu 2 sao") hoặc một đề, cho lớp nào hoặc tất cả, có hạn nộp.
- [x] Học sinh: mục "Bài được giao" ở trang chủ, sắp theo hạn, đánh dấu đã xong / quá hạn.
- [x] Giáo viên: ai đã làm, ai chưa, điểm/sao từng em. Tính từ `PlaySession` / `ExamAttempt` có sẵn.

Quy tắc đã chọn khi làm C3 (đổi được nếu thầy cô thấy chưa hợp):

- **Bài game** chỉ tính lượt chơi **từ lúc giao bài**; lượt cũ của cùng Unit không tính. Đạt đủ sao trong một lượt là xong.
- **Bài đề** tính mọi lượt đã nộp của đề đó (kể cả trước khi giao), vì đề có thể chỉ cho làm một lần.
- Làm xong sau hạn vẫn được ghi nhận, hiện là **"Nộp muộn"**; chưa làm mà qua hạn là **"Quá hạn"**.
- "Giao cho tất cả" = mọi em có tài khoản đang hoạt động, đúng cấp học / khối của nội dung, trừ em ở lớp đã lưu trữ. Giao theo lớp thì máy kiểm tra lớp đó làm được nội dung (đúng cấp học), Unit / đề đã công khai và game đã gán cho Unit.
- Em thấy bài trên trang chủ tới 14 ngày sau hạn. Giáo viên sao chép được danh sách tên em chưa làm (theo lớp) để gửi nhóm phụ huynh.

**Xong khi:** giáo viên giao bài tối thứ Hai hạn thứ Năm, sáng thứ Năm biết ngay em nào chưa làm.

### C4 — Game cho cấp 2 (≈ 3 tuần)

Game mới đọc từ ngân hàng câu hỏi (C1), dùng chung khung chơi hiện có:

| Game | Dạng câu hỏi | Ghi chú |
|---|---|---|
| Grammar Rush | Trắc nghiệm, chia động từ | Tính giờ, chuỗi trả lời đúng liên tiếp được thưởng |
| Sentence Builder | Sắp xếp câu | Dùng lại kéo thả của Word Builder |
| Sound & Stress | Phát âm, trọng âm | Bấm vào từ để nghe đọc từng từ |
| Word Family | Word form | Một gốc từ → điền danh/động/tính/trạng từ |
| Error Hunter | Tìm lỗi sai | Bấm vào phần sai trong câu |

**Xong khi:** mỗi game có logic + unit test, chạy trên điện thoại và máy tính, lưu kết quả và cho sao như 5 game hiện có.

### C5 — Ôn thi vào lớp 10 (≈ 2 tuần)

- [ ] **Ma trận đề:** giáo viên khai báo cấu trúc (vd: 2 câu phát âm, 2 trọng âm, 12 trắc nghiệm, 1 bài đọc…); máy tạo đề ngẫu nhiên từ ngân hàng theo ma trận, mỗi em một đề khác nhau. Cấu trúc thi mỗi tỉnh mỗi khác nên để giáo viên tự khai báo.
- [ ] Lịch thi thử (đề mở theo giờ), lịch sử điểm của từng em qua các lần thi thử.
- [ ] Trang "Em hay sai dạng nào": tỉ lệ đúng của em theo dạng bài và điểm ngữ pháp, gợi ý Unit/game để ôn.

**Xong khi:** em lớp 9 làm 3 đề thi thử khác nhau theo cùng ma trận và thấy mình tiến bộ ở dạng bài nào.

### Sau đó (chưa xếp lịch)

- **Ôn tập thông minh:** từ nào em hay sai thì hiện lại sớm hơn (lặp lại ngắt quãng), dựa trên `PlayAnswer` / `ExamAnswer` đã có.
- **Bảng xếp hạng theo lớp** (cấp 2 thích thi đua): chỉ hiện tên hiển thị, giáo viên tắt được.
- **Nghe hiểu:** `Passage` có audio.
- Phần thành tích + thống kê của PLAN.md Giai đoạn 5 gộp dần vào báo cáo của C2/C3, không làm riêng.

---

## 6. Tổng thời gian ước lượng

| Giai đoạn | Thời gian | Cộng dồn |
|---|---|---|
| C0. Lớp + cấp học | 1,5 tuần | 1,5 |
| C1. Ngân hàng câu hỏi | 3 tuần | 4,5 |
| C2. Luyện đề + thi | 3 tuần | 7,5 |
| C3. Bài tập về nhà | 2 tuần | 9,5 |
| C4. Game cấp 2 | 3 tuần | 12,5 |
| C5. Ôn thi vào 10 | 2 tuần | 14,5 |

→ Các em cấp 2 chơi được game từ vựng **sau khoảng 1,5 tuần**; luyện đề trên điện thoại **sau khoảng 2 tháng**; đầy đủ **sau khoảng 3,5 tháng** (theo giả định 10–15 giờ/tuần). C3 có thể làm trước C2 nếu giao bài tập gấp hơn luyện đề.

---

## 7. Những điểm cần chốt thêm

1. Một em có thể ở **nhiều lớp** không (vd: lớp chính + lớp bồi dưỡng)? Kế hoạch đang giả định mỗi em một lớp.
2. ~~Xem đáp án ngay sau khi nộp?~~ **Đã chốt (26/11/2026):** đề "thi" chỉ hiện điểm sau khi nộp, đáp án và giải thích mở sau giờ đóng đề; đề "luyện tập" xem ngay. Giáo viên vẫn đổi được từng đề (`showResult`).
3. Cấu trúc đề thi vào 10 ở tỉnh/thành của bạn (số câu từng dạng, có tự luận không) để làm sẵn một ma trận mẫu.
4. Có cần **in đề ra giấy** (xuất PDF/Word) từ ngân hàng câu hỏi không?
