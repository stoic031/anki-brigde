# 📝 Module 3: Note Creation & Controls

> Xem [`README.md`](README.md) cho tổng quan kiến trúc.

## 3.1. Custom Markdown Block

Plugin dùng `registerMarkdownCodeBlockProcessor('anki-controls', ...)` để đăng ký một code block xử lý riêng. Content chứa một fenced code block ```` ```anki-controls ``` ```` (không cần nội dung bên trong); Obsidian gọi processor này để render HTML buttons thay cho code block, ở cả Reading mode lẫn Live Preview.

> Đã verify bằng throwaway plugin (`poc-anki-controls-codeblock/`, xem `docs/design-open-questions.md` lịch sử) — `registerMarkdownCodeBlockProcessor` render đúng và bắt event click ở cả hai mode. `%%anki-controls%%` (cú pháp comment của Obsidian) đã bị loại bỏ vì không đáng tin cậy, đặc biệt ở Live Preview.

## 3.2. Button Actions

> **Nguyên tắc chung cho 3 nút AI** (Generate with AI, Add Audio, Add Image): không nút
> nào trong 3 nút này gọi `updateNoteFields` — mỗi nút chỉ ghi vào **content của note
> Obsidian**. Field trên Anki chỉ được cập nhật khi user bấm 🔄 Sync một cách tường minh.
> Cả 3 đều đọc input từ **content**, không đọc từ tên file/tiêu đề note — đổi tên file sau
> khi tạo không làm hỏng hành vi của các nút này.

**🔄 Sync Button:**

- Điều kiện hiển thị: Luôn hiện
- Action: Đọc frontmatter + content → Gọi AnkiConnect addNote/updateNoteFields → Lưu anki_note_id vào frontmatter
- Visual feedback: Button đổi thành "✅ Synced" trong 2 giây

**🗑️ Delete Button:**

- Điều kiện hiển thị: Chỉ hiện khi có `anki_note_id` trong frontmatter
- Action: Hiển thị confirm modal → Gọi AnkiConnect deleteNotes → Xóa `anki_note_id` khỏi frontmatter
- Visual feedback: Button ẩn đi sau khi xóa

**🤖 Generate with AI Button:**

- Điều kiện hiển thị: **luôn hiện**, cho phép bấm lại nhiều lần. Lưu ý: khác với template
  chung ở `AGENTS.md` mục "Add a new button to the controls block" (vốn mặc định tự ẩn
  sau khi thành công) — đây là ngoại lệ có chủ đích, vì user có thể muốn Generate lại sau
  khi tự sửa một vài field.
- Input: đọc word từ section của **field đầu tiên** trong Model — tức `fields[0]` lấy từ
  `modelFieldNames(anki_model)`, sau đó tìm section khớp tên theo đúng quy tắc
  normalize/lookup ở `../contracts.md` §2/§3. Không hard-code `"## Word"` — Model khác có
  thể đặt tên field đầu tiên khác (VD "Front").
- Edge case: nếu section đó đang rỗng khi bấm nút → hiển thị Notice lỗi "Please fill in
  the [FieldName] section first.", dừng lại, không gọi AI Provider.
- Action: Gọi AI Provider `processText(word, 'extract-vocabulary')` (`../contracts.md`
  §4) → nhận `TextResult` → với mỗi field không rỗng trả về (meaning, furigana,
  partOfSpeech, collocations, exampleSentences), tìm section `## SectionName` khớp tên:
  - Section đã tồn tại và đang rỗng → điền vào.
  - Section đã tồn tại và đã có nội dung → **bỏ qua**, không ghi đè dữ liệu user đã nhập.
  - Section chưa tồn tại trong note (Model hiện tại không có field đó, VD Basic không có
    Furigana) → **tạo mới ở cuối file** rồi điền vào — không được âm thầm bỏ dữ liệu AI
    trả về chỉ vì Model không map field đó (giống cách Audio/Image tạo section mới ở §3.4).
- Visual feedback: Button đổi thành "⏳ Generating..." → "✅ Done!" → quay lại trạng thái
  **bình thường** sau 2 giây (**không ẩn** — khác với Add Audio/Add Image).

**🔊 Add Audio Button:**

- Điều kiện hiển thị: quét **toàn bộ content** (không chỉ section "## Audio"); nếu chuỗi
  `[sound:` xuất hiện ở bất kỳ đâu → ẩn button. Không quan tâm file đó còn tồn tại trong
  Anki media folder hay không, và không quan tâm có bao nhiêu section "## Audio" — chỉ
  cần match chuỗi `[sound:` là đủ điều kiện ẩn.
- Action: Đọc word + example từ content → Gọi AI Provider generateAudio → Gọi AnkiConnect storeMediaFile → Chèn `[sound:filename.mp3]` vào section "## Audio"
- Visual feedback: Button đổi thành "⏳ Generating..." → "✅ Done!" → Ẩn đi

**🖼️ Add Image Button:**

- Điều kiện hiển thị: quét **toàn bộ content**; nếu chuỗi `<img src="` xuất hiện ở bất kỳ
  đâu → ẩn button. Cùng quy tắc như Add Audio ở trên.
- Action: Đọc word + meaning từ content → Gọi AI Provider generateImage → Gọi AnkiConnect storeMediaFile → Chèn `<img src="filename.png">` vào section "## Image"
- Visual feedback: Button đổi thành "⏳ Generating..." → "✅ Done!" → Ẩn đi

## 3.3. Content Parsing Logic

Plugin parse content theo cấu trúc heading:

- Tìm tất cả heading `## SectionName`
- Với mỗi heading, lấy nội dung cho đến heading tiếp theo hoặc end of file
- Extract data dựa trên section name:
  - "## Word" → text paragraph
  - "## Collocations" → list items (dòng bắt đầu bằng `-`)
  - "## Audio" → `[sound:filename]` pattern
  - "## Image" → `<img src="filename">` pattern

## 3.4. Content Update Logic

Nguyên tắc chung cho cả 3 nút AI: **không bao giờ phá dữ liệu user đã tự nhập.** Cách áp
dụng khác nhau đôi chút giữa Audio/Image và Generate with AI:

**Audio/Image** (nhiều tag có thể cùng tồn tại hợp lý trong 1 section):

- Tìm section "## Audio" hoặc "## Image"
- Nếu chưa có section → tạo mới ở cuối file
- Nếu đã có section → append vào cuối section
- Save file → Trigger re-render → Button tự động ẩn đi

**Generate with AI** (§3.2) — mỗi field trả về map với đúng 1 section, append không hợp
lý vì sẽ tạo ra 2 đoạn text lẫn lộn dưới cùng 1 heading:

- Section tương ứng chưa tồn tại trong note → tạo mới ở cuối file, rồi điền vào (giống
  quy tắc "tạo nếu thiếu" ở trên).
- Section tồn tại và đang rỗng → điền vào.
- Section tồn tại và đã có nội dung → **bỏ qua**, không append, không ghi đè.
- Save file → Trigger re-render → Button **không** ẩn (xem §3.2).

## 3.5. Media File Naming Convention

- **Prefix:** `_obsidian_` (để Anki không xóa nhầm khi Check Media)
- **Format:** `_obsidian_{word}_{type}_{timestamp}.{ext}`
- **Ví dụ:**
  - `_obsidian_診察_audio_1698765432.mp3`
  - `_obsidian_apple_image_1698765433.png`

## 3.6. Auto-generate Content Structure

Khi user tạo note mới (qua command hoặc hotkey), plugin tự động sinh ra content structure dựa trên Model được chọn trong Sidebar Modal:

**Ví dụ với Model "Basic (and reversed card)" (fields: Front, Back):**

````markdown
```anki-controls
```

## Front

## Back
````

**Ví dụ với Model "Japanese Vocabulary" (fields: Word, Meaning, Furigana, Audio, Image):**

````markdown
```anki-controls
```

## Word

## Meaning

## Furigana

## Audio

## Image
````

## 3.7. Tạo Note Từ Text Được Chọn (Hotkey / Quick Capture)

Cách tạo note nhanh nhất: bôi đen 1 từ đang đọc, bấm hotkey, note mới xuất hiện ngay
trong cùng folder — không cần mở Sidebar Modal, không cần nhập tên.

**Trigger:**

- Obsidian Command (`this.addCommand`, id ổn định `create-note-from-selection`) gán với
  hotkey do user tự cấu hình. **Không ship default hotkey** — theo convention phổ biến
  của community plugin, tránh đụng hotkey user đã gán cho plugin khác.
- Nguồn text: `editor.getSelection()` trên **note markdown đang active**. Chỉ vậy.

> **PDF ngoài phạm vi (chưa hỗ trợ).** Obsidian không có API chính thức cho plugin đọc
> text bôi đen trong PDF viewer. Cách duy nhất khả thi (dùng bởi một số plugin PDF cộng
> đồng) là đọc `window.getSelection()` khi PDF view đang active — hành vi không được
> document chính thức, có thể vỡ khi Obsidian đổi PDF renderer. Quyết định: **bỏ qua PDF
> ở M1-2/v1**, chỉ hỗ trợ note markdown. Nếu làm PDF sau này, verify bằng throwaway
> plugin trước khi cam kết vào design doc chính — giống cách đã verify
> `registerMarkdownCodeBlockProcessor` ở §3.1.

**Flow:**

1. User bôi đen text trong note markdown đang mở.
2. Bấm hotkey đã gán cho command `create-note-from-selection`.
3. Plugin đọc Deck/Model đã lưu gần nhất trong settings (`07-sidebar.md` §7.4
   Persistence).
   - Chưa từng chọn Deck/Model → Notice lỗi: "No Deck/Model selected yet. Please open
     the Anki sidebar and select a Deck and Model first." → dừng lại, **không tạo note**.
     (Lỗi này gắn với điều kiện tiên quyết của flow tạo note, không thuộc danh sách lỗi
     sync ở `01-sync.md` §1.6 — nhưng theo cùng convention copy: nói rõ cái gì hỏng và
     bước tiếp theo là gì.)
   - Đã có → tiếp tục.
4. Plugin tính filename = `sanitizeForFilename(selectedText)` + `.md` (tái dùng hàm từ
   `../contracts.md` §5 — vốn trước đây chỉ dùng cho tên file media, nay dùng chung cho
   tên note). Folder đích = folder chứa file đang active.
   - Trùng tên file đã tồn tại trong folder đó → tự thêm hậu tố số (hành vi mặc định của
     Obsidian khi tạo file trùng tên, VD "word 1.md") — không ghi đè, không báo lỗi,
     không mở file cũ thay vào.
5. Plugin tạo note với content skeleton **giống hệt §3.6** (một `## SectionName` cho mỗi
   field của Model, theo đúng thứ tự `modelFieldNames`) — **ngoại lệ duy nhất**: section
   của field đầu tiên (`fields[0]`) được điền sẵn text đã chọn; các section còn lại để
   trống như §3.6 mô tả.
   - Frontmatter: `anki_deck`, `anki_model` lấy từ settings đã resolve ở bước 3.
6. Mở note mới trong editor (giống bước cuối của `07-sidebar.md` §7.3).

Sau khi note được tạo, việc điền Meaning/Furigana/... không còn tự động — user tự bấm
"🤖 Generate with AI" trong note-controls (§3.2) khi cần, có thể bấm lại nhiều lần.

---

> Đánh số Module nhảy **3 → 5** có chủ đích: Module 4 đã bị bỏ khỏi kế hoạch, không phải
> lỗi đánh số. Module tiếp theo là [`05-ui.md`](05-ui.md).
