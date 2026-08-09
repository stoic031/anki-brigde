# 📝 Module 3: Note Creation & Controls

> Xem [`README.md`](README.md) cho tổng quan kiến trúc.

## 3.1. Custom Markdown Block

Plugin dùng `registerMarkdownCodeBlockProcessor('anki-controls', ...)` để đăng ký một code block xử lý riêng. Content chứa một fenced code block ```` ```anki-controls ``` ```` (không cần nội dung bên trong); Obsidian gọi processor này để render HTML buttons thay cho code block, ở cả Reading mode lẫn Live Preview.

> Đã verify bằng throwaway plugin (`poc-anki-controls-codeblock/`, xem `docs/design-open-questions.md` lịch sử) — `registerMarkdownCodeBlockProcessor` render đúng và bắt event click ở cả hai mode. `%%anki-controls%%` (cú pháp comment của Obsidian) đã bị loại bỏ vì không đáng tin cậy, đặc biệt ở Live Preview.

## 3.2. Button Actions

Note-controls hiện đúng 5 nút: 🔄 Sync | 🤖 Generate with AI | 🔊 Add Audio |
🖼️ Add Image | 🗑️ Delete.

> **Nguyên tắc chung cho 3 nút AI** (Generate with AI, Add Audio, Add Image): không nút
> nào trong 3 nút này gọi `updateNoteFields` — mỗi nút chỉ ghi vào **content của note
> Obsidian**. Field trên Anki chỉ được cập nhật khi user bấm 🔄 Sync một cách tường minh.
> Cả 3 đều đọc input từ **content**, không đọc từ tên file/tiêu đề note — đổi tên file sau
> khi tạo không làm hỏng hành vi của các nút này. Cả 3 nút **không mở modal chọn field**
> khi bấm — cấu hình field đã được chọn sẵn từ trước trong Sidebar Modal
> (`07-sidebar.md` §7.2, Tab 1/2/3), theo đúng cặp Deck+Model của note đang mở. Bấm nút
> là generate ngay; không có bước tick checkbox tại thời điểm bấm.

**🔄 Sync Button:**

- Điều kiện hiển thị: Luôn hiện
- Action: Đọc frontmatter + content → Gọi AnkiConnect addNote/updateNoteFields → Lưu anki_note_id vào frontmatter
- Visual feedback: Button đổi thành "✅ Synced" trong 2 giây

**🗑️ Delete Button:**

- Điều kiện hiển thị: Chỉ hiện khi có `anki_note_id` trong frontmatter
- Action: Hiển thị confirm modal → Gọi AnkiConnect deleteNotes → Xóa `anki_note_id` khỏi frontmatter
- Visual feedback: Button ẩn đi sau khi xóa

**Pre-check dùng chung cho 3 nút AI:** mỗi nút, trước khi làm gì, đọc cấu hình đã lưu
cho cặp Deck+Model của note đang mở (`07-sidebar.md` §7.4). Chưa cấu hình (theo định
nghĩa "chưa cấu hình" ở `07-sidebar.md` §7.4) → hiển thị Notice và **dừng lại, không
làm gì khác**:

- Generate with AI, chưa tick field nào ở Tab 1 → "Please configure AI field generation
  for this Deck/Model in the sidebar (Tab 1) first."
- Add Audio, Tab 2 chưa có dòng mapping nào → "Please configure Audio field mapping for
  this Deck/Model in the sidebar (Tab 2) first."
- Add Image, Tab 3 chưa chọn Input/Output → "Please configure Image field mapping for
  this Deck/Model in the sidebar (Tab 3) first."

**🤖 Generate with AI Button** (chỉ áp dụng cho text — Audio/Image có nút riêng):

- Qua pre-check ở trên (Tab 1 đã tick ít nhất 1 field) thì đọc word từ section của
  **field đầu tiên** trong Model — tức `fields[0]` lấy từ `modelFieldNames(anki_model)`,
  tìm section khớp tên theo đúng quy tắc normalize/lookup ở `../contracts.md` §2/§3.
  Không hard-code `"## Word"` — Model khác có thể đặt tên field đầu tiên khác (VD
  "Front"). Section đó đang rỗng → hiển thị Notice lỗi "Please fill in the [FieldName]
  section first.", dừng lại.
- `targetFields` = các field đã tick ở Tab 1 cho Deck+Model này → gọi AI Provider
  `processText(word, 'extract-vocabulary', targetFields)` (`../contracts.md` §4) →
  nhận `TextResult` (key = đúng tên field trong `targetFields`) → với mỗi key không
  rỗng trả về, tìm section `## FieldName` khớp **chính xác** tên đó (không cần alias vì
  key đã đúng tên Model):
  - Section đang rỗng → điền vào.
  - Section đã có nội dung → **bỏ qua**, không ghi đè dữ liệu user đã nhập.
- Visual feedback: Button đổi thành "⏳ Generating..." → "✅ Done!" → quay lại trạng thái
  bình thường sau 2 giây.

**🔊 Add Audio Button:**

- Qua pre-check ở trên thì với **mỗi dòng** đã cấu hình ở Tab 2 (`07-sidebar.md`
  §7.2.2): đọc nội dung hiện tại của section **Input** làm input → gọi AI Provider
  `generateAudio(fieldContent, { voice, language })` (voice/language lấy từ Tab 2) →
  gọi AnkiConnect `storeMediaFile` → ghi tag `[sound:filename.mp3]` vào cuối section
  **Output** của dòng đó, theo tuỳ chọn Overwrite/Append của Tab 2 (xem §3.4).
  - Section Input đang rỗng → bỏ qua dòng đó (không có gì để đọc), không báo lỗi cả
    nút.
- Visual feedback: Button đổi thành "⏳ Generating..." → "✅ Done!" → quay lại trạng thái
  bình thường.

**🖼️ Add Image Button:**

- Qua pre-check ở trên thì đọc nội dung hiện tại của section **Input** (Tab 3,
  `07-sidebar.md` §7.2.3) làm prompt → gọi AI Provider `generateImage(fieldContent,
  opts)` → gọi AnkiConnect `storeMediaFile` → ghi tag `<img src="filename.png">` vào
  cuối section **Output**, theo tuỳ chọn Overwrite/Append của Tab 3 (xem §3.4).
  - Section Input đang rỗng → không làm gì, hiển thị Notice "Nothing to generate an
    image from — please fill in the [InputFieldName] section first."
- Visual feedback: Button đổi thành "⏳ Generating..." → "✅ Done!" → quay lại trạng thái
  bình thường.

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
dụng khác nhau đôi chút giữa Audio/Image và Generate with AI. Audio/Image chỉ áp dụng
cho dòng field-mapping đã cấu hình ở Tab 2/3 (`07-sidebar.md` §7.2.2/§7.2.3) — field
Output không nằm trong cấu hình thì không bị đụng tới.

**Audio/Image** (field Input/Output = theo dòng mapping đã cấu hình, không còn cố định
"## Audio"/"## Image"; hành vi ghi vào section Output phụ thuộc tuỳ chọn **Overwrite /
Append** của Tab 2/3):

- Section Input đang rỗng → bỏ qua dòng đó (không có input để đọc).
- Tuỳ chọn **Append** (mặc định): section Output đã có tag `[sound:...]`/
  `<img src="...">` từ trước → giữ nguyên tag cũ, thêm tag mới vào cuối section. Section
  Output chưa có tag nào → thêm tag mới.
- Tuỳ chọn **Overwrite**: xoá (các) tag `[sound:...]`/`<img src="...">` hiện có trong
  section Output — chỉ xoá tag, giữ nguyên text khác user đã viết thêm trong section đó
  — rồi ghi tag mới vào.
- Save file → Trigger re-render → Button **không** ẩn (xem §3.2).

**Generate with AI** (§3.2) — mỗi field trong `TextResult` trả về map với đúng 1
section, append không hợp lý vì sẽ tạo ra 2 đoạn text lẫn lộn dưới cùng 1 heading:

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

Dùng chung Sidebar Modal và cùng cơ chế 2-nhánh với `07-sidebar.md` §7.3 (Deck/Model/
Folder đã từng cấu hình hay chưa) — khác biệt duy nhất so với §7.3: filename lấy từ text
đã bôi đen (không hỏi tên). Folder đích **dùng Folder select đã lưu ở Tab 1** (giống hệt
§7.3), không phải folder của note đang active.

1. User bôi đen text trong note markdown đang mở.
2. Bấm hotkey đã gán cho command `create-note-from-selection`.
3. Plugin tính filename = `sanitizeForFilename(selectedText)` + `.md` (tái dùng hàm từ
   `../contracts.md` §5 — vốn trước đây chỉ dùng cho tên file media, nay dùng chung cho
   tên note).
4. Plugin resolve Deck/Model/Folder theo đúng cơ chế `07-sidebar.md` §7.3 (không có ô
   nhập tên note ở bất kỳ nhánh nào — tên đã có từ text bôi đen):
   - **Tab 1 đã có giá trị "hiện tại"** (đã lưu từ lần trước) → tạo note ngay, bỏ qua
     bước 5.
   - **Tab 1 chưa có, nhưng Settings Tab (`06-settings.md` §6.1) đã cấu hình
     Deck/Model/Folder mặc định** → seed Tab 1 bằng default này, tạo note ngay (không
     hỏi lại gì), bỏ qua bước 5.
   - **Cả Tab 1 lẫn Settings Tab đều chưa cấu hình gì** → hiện Notice "Please configure
     Deck, Model, and Save location in Settings first", tự mở Obsidian Settings tới tab
     của plugin, **không tạo note**, dừng lại (không có bước 5 trở đi).
5. Trùng tên file đã tồn tại trong Folder đích → tự thêm hậu tố số (hành vi mặc định của
   Obsidian khi tạo file trùng tên, VD "word 1.md") — không ghi đè, không báo lỗi, không
   mở file cũ thay vào.
6. Plugin tạo note với content skeleton **giống hệt §3.6** (một `## SectionName` cho mỗi
   field của Model, theo đúng thứ tự `modelFieldNames`) — **ngoại lệ duy nhất**: section
   của field đầu tiên (`fields[0]`) được điền sẵn text đã chọn; các section còn lại để
   trống như §3.6 mô tả.
   - Frontmatter: `anki_deck`, `anki_model` lấy từ Deck/Model đã resolve ở bước 4.
7. Mở note mới trong editor (tại Folder đích đã resolve ở bước 4).
8. Nếu Sidebar Modal chưa mở → tự mở ra (Tab 1), để user xem lại/đổi Deck/Model/Folder
   cho note vừa tạo nếu cần (giống `07-sidebar.md` §7.3 bước cuối).

Sau khi note được tạo, việc điền Meaning/Furigana/... không còn tự động — user tự bấm
"🤖 Generate with AI" trong note-controls (§3.2) khi cần, có thể bấm lại nhiều lần.

---

> Đánh số Module nhảy **3 → 5** có chủ đích: Module 4 đã bị bỏ khỏi kế hoạch, không phải
> lỗi đánh số. Module tiếp theo là [`05-ui.md`](05-ui.md).
