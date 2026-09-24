# 📝 Module 3: Note Creation & Controls

> Xem [`README.md`](README.md) cho tổng quan kiến trúc.

## 3.1. Vị trí các nút điều khiển

Các nút hành động của note (Sync, Rebuild, Delete, Generate with AI, và sau này Add Image) nằm ở **Sidebar**, không còn nằm trong nội dung note — xem
[`07-sidebar.md`](07-sidebar.md) §7.2. Note chỉ chứa frontmatter và các section `## Field`,
không còn khối ` ```anki-controls ` (trước đây do `registerMarkdownCodeBlockProcessor`
render).

- Lý do: một nơi cho cả cấu hình lẫn hành động; note sạch hơn (không phải sinh/giữ khối
  điều khiển, không phụ thuộc Reading/Live Preview); trạng thái nút cập nhật theo sự kiện
  (VD nút Delete xuất hiện ngay sau lần sync đầu tiên).
- Note cũ còn khối ` ```anki-controls ` vẫn hợp lệ: plugin không còn xử lý nên nó hiện
  như một code block thường, sync bỏ qua vì nằm trước `## ` đầu tiên (§3.3). Bấm
  **Rebuild** sẽ dọn nó cùng phần nội dung còn lại.

## 3.2. Button Actions

Các nút nằm ở Sidebar (`07-sidebar.md` §7.2.1). Hiện có: **Sync | Rebuild | Delete** (cùng
một hàng, tab Note), **Generate** (tab Text, cạnh phần chọn field), và **Add image**
(tab Image, cạnh phần chọn Output field). Mỗi nút gồm icon + chữ. Add image gọi
`generateImage()` của image provider user đã chọn.

> **Nguyên tắc chung cho 2 nút AI** (Generate, Add Image): không nút
> nào trong 2 nút này gọi `updateNoteFields` — mỗi nút chỉ ghi vào **content của note
> Obsidian**. Field trên Anki chỉ được cập nhật khi user bấm 🔄 Sync một cách tường minh.
> Cả 2 đều đọc input từ **content**, không đọc trực tiếp tên file/tiêu đề note tại thời
> điểm bấm nút — đổi tên file sau khi tạo không tự làm hỏng hành vi của các nút này. Điểm
> khác so với trước: Generate giờ đọc input từ section của **Main Field**
> (`07-sidebar.md` §7.2.1) thay vì field đầu tiên cố định — nội dung Main Field ban đầu
> thường bắt nguồn từ tên note lúc tạo/rebuild (§3.6, §3.7), nhưng vẫn là content thường,
> user sửa tay được, và Generate vẫn chỉ đọc content đó, không tự đọc lại tên file. Cả 2
> nút **không mở modal chọn field**
> khi bấm — cấu hình field đã được chọn sẵn từ trước trong Sidebar Modal
> (`07-sidebar.md` §7.2, tab Text/Image), theo đúng cặp Deck+Model của note đang mở. Add
> Image vẫn là 1 bấm = ghi note ngay. Generate thì tách 2 bước: bấm Generate chỉ gọi AI và
> hiện preview cho sửa, chưa ghi note; bấm **Write** riêng mới thực sự ghi (xem §3.4 và
> `07-sidebar.md` §7.2.1) — không có bước tick checkbox tại thời điểm bấm Generate.

**Sync Button** (icon `refresh-cw`):

- Điều kiện hiển thị: Luôn hiện; vô hiệu khi không có note markdown đang mở
- Action: Đọc frontmatter + content → Gọi AnkiConnect addNote/updateNoteFields → Lưu anki_note_id vào frontmatter
- Visual feedback: "⏳ Processing..." → "✅ Done!" trong 2 giây (lỗi: "❌ Error" 3 giây, kèm toast)

**Rebuild Button** (icon `hammer`):

- Đồng bộ nội dung note theo Model hiện tại: xoá toàn bộ nội dung dưới frontmatter và sinh
  lại skeleton §3.6. Chi tiết và modal xác nhận: `07-sidebar.md` §7.2.1.
- Vô hiệu khi không có note đang mở hoặc note chưa có `anki_model`.

**Delete Button** (icon `trash-2`):

- Điều kiện hiển thị: Chỉ hiện khi có `anki_note_id` trong frontmatter — tự hiện/ẩn theo
  frontmatter của note đang mở (hiện ngay sau lần sync đầu)
- Action: Hiển thị confirm modal → Gọi AnkiConnect deleteNotes → Xóa `anki_note_id` khỏi frontmatter
- Visual feedback: Button ẩn đi sau khi xóa

**Pre-check dùng chung cho 2 nút AI:** mỗi nút, trước khi làm gì, đọc cấu hình đã lưu
cho cặp Deck+Model của note đang mở (`07-sidebar.md` §7.4). Chưa cấu hình (theo định
nghĩa "chưa cấu hình" ở `07-sidebar.md` §7.4) → hiển thị Notice và **dừng lại, không
làm gì khác**:

- Generate with AI, chưa thêm field nào ở tab Text → "Please configure AI field generation
  for this Deck/Model in the sidebar (Text tab) first."
- Generate with AI, chưa chọn Main Field (`07-sidebar.md` §7.2.1) → "Please choose a main
  field for this deck/model in the sidebar first."
- Add Image, tab Image chưa chọn field Output → "Please configure Image field mapping for
  this Deck/Model in the sidebar (Image tab) first."

**Generate Button** (icon `sparkles`, tab Text; chỉ áp dụng cho text — Image có nút riêng).
Generate chỉ gọi AI và điền preview có thể sửa — **không ghi vào note**; ghi thật sự là
việc của nút **Write** riêng (dưới đây). Tách 2 bước để user xem/sửa nội dung AI sinh ra
trước khi nó chạm vào note.

- Qua pre-check ở trên (tab Text đã thêm ít nhất 1 field, Main Field đã chọn — xem
  `07-sidebar.md` §7.2.1) thì đọc word từ section của **Main Field** đã cấu hình cho cặp
  Deck+Model này (`settings.mainFieldConfig`), tìm section khớp tên theo đúng quy tắc
  normalize/lookup ở `../contracts.md` §2/§3. Không hard-code `"## Word"` — Main Field có
  thể là bất kỳ field nào user chọn (VD "Front"). Section đó đang rỗng → hiển thị Notice
  lỗi "Please fill in the [FieldName] section first.", dừng lại. Chưa có text provider hợp
  lệ (`getTextProvider()` = null) → Notice "Set up a text model in settings first.", dừng
  lại (chưa gọi mạng).
- `targetFields` = các field đã thêm ở tab Text cho Deck+Model này, **bỏ Main Field**
  (chính là input; không có gì để sinh) → gọi AI Provider
  `processText(word, 'extract-vocabulary', targetFields, context)` (`../contracts.md`
  §4) một lần cho toàn bộ `targetFields` → nhận `TextResult` (key = đúng tên field) →
  điền vào ô preview (editable) ngay dưới field tương ứng ở tab Text — **chưa đụng tới
  note**. Bấm Generate lần sau ghi đè preview cũ (regenerate toàn bộ, không giữ phần đã
  sửa tay). `context` (`02-providers.md` §2.4) gồm Learning language của profile đang chọn
  (không phụ thuộc Deck+Model của note) và Your language toàn cục (`06-settings.md` §6.1/§6.2) — cả hai
  không bắt buộc, không có thì `context` rỗng, prompt không đổi so với trước.
- Kết quả: không có preview nào có nội dung (mọi key trả về rỗng) → Notice "The text model
  returned nothing to add. Try again or check the model." Lỗi provider → toast "❌
  {provider}: {lý do} ({URL})". Trong lúc chờ có Notice "⏳ Asking the text model…" (ẩn khi
  xong).
- Visual feedback: Button đổi thành "⏳ Generating..." → "✅ Done!" → quay lại trạng thái
  bình thường sau 2 giây.

**Write Button** (icon `save`, tab Text; cạnh nút Generate) — ghi nội dung preview hiện tại
(đã sửa tay hoặc chưa) của **tất cả** field đã thêm vào note, trong một lần bấm.

- Không có preview nào có nội dung (chưa Generate lần nào, hoặc đã xoá hết) → Notice
  "Generate content first.", dừng lại, không gọi gì khác.
- Với mỗi field có nội dung, tìm section `## FieldName` khớp tên field (không phân biệt
  hoa/thường; nếu không có thì thử alias như sync, để `Back` dùng lại `## Meaning` thay vì
  tạo trùng):
    - Section đang rỗng → điền vào.
    - Section đã có nội dung → **bỏ qua**, không ghi đè dữ liệu user đã nhập (note có thể đã
      đổi từ lúc Generate tới lúc Write).
    - Chưa có section → thêm `## FieldName` ở cuối note.
    - Ghi bằng một lần `vault.process`; chỉ đụng phần section, frontmatter và text khác giữ
      nguyên từng byte. Không gọi `updateNoteFields` — Anki chỉ cập nhật khi user bấm Sync.
- Kết quả: toast "✅ AI content generated: N filled[, M skipped (already had content)]." rồi
  xoá hết preview (đã ghi xong). Ghi lỗi (I/O) → toast "❌ Failed to write to the note.",
  preview giữ nguyên để user thử lại.
- Visual feedback: giống Generate — "⏳ Writing..." → "✅ Done!"/"❌ Error" → quay lại trạng
  thái bình thường. Không có Notice tiến trình riêng (ghi vào note là local, không gọi
  mạng).

**Add Image Button** (icon `image`, tab Image):

- Qua pre-check ở trên thì thực hiện 2 bước, cả hai đều qua provider user đã cấu hình:
    1. Gom nội dung các section **không rỗng** của note (trừ section Output) → gọi **text
       provider** `processText(fields, 'build-image-prompt', [])` để nó viết prompt tạo ảnh.
    2. Gọi image provider `generateImage(prompt, opts)` → gọi AnkiConnect `storeMediaFile` →
       ghi tag `<img src="filename.png">` vào cuối section **Output**, theo tuỳ chọn
       Overwrite/Append của tab Image (xem §3.4).
    - Obsidian hiển thị ảnh bằng cách đọc file từ Anki (`retrieveMediaFile`) lúc render
      (markdown post-processor, `src/note/ankiImages.ts`): chỉ với note có `anki_deck`, chỉ
      `<img src>` là tên file trần không có trong vault; thay `src` bằng data URL giữ trong bộ nhớ,
      không ghi gì vào vault. Anki tắt / không có file → ảnh vẫn vỡ, không hiện Notice (render
      thụ động), lần render sau thử lại.
    - Chưa cấu hình text provider → Notice "Set up a text model in settings to generate image
      prompts." và dừng (không gửi field thô tới image provider).
    - Không có section nào không rỗng → Notice "Nothing to generate an image from — please
      fill in at least one field first."
- Visual feedback: Button đổi thành "⏳ Generating..." → "✅ Done!" → quay lại trạng thái
  bình thường.

## 3.3. Content Parsing Logic

Plugin parse content theo cấu trúc heading:

- Tìm tất cả heading `## SectionName`
- Với mỗi heading, lấy nội dung cho đến heading tiếp theo hoặc end of file
- Extract data dựa trên section name:
    - "## Word" → text paragraph
    - "## Collocations" → list items (dòng bắt đầu bằng `-`)
    - "## Audio" → `[sound:filename]` pattern (chỉ để đọc thẻ đã có; plugin không tạo audio)
    - "## Image" → `<img src="filename">` pattern

## 3.4. Content Update Logic

Nguyên tắc chung cho cả 2 nút AI: **không bao giờ phá dữ liệu user đã tự nhập.** Cách áp
dụng khác nhau đôi chút giữa Image và Generate with AI. Image chỉ áp dụng
cho field Output đã cấu hình ở tab Image (`07-sidebar.md` §7.2.2) — field
Output không nằm trong cấu hình thì không bị đụng tới.

**Image** (field Output = theo cấu hình tab Image; hành vi ghi vào section Output phụ thuộc
tuỳ chọn **Overwrite / Append** của tab Image):

- Tuỳ chọn **Append** (mặc định): section Output đã có tag
  `<img src="...">` từ trước → giữ nguyên tag cũ, thêm tag mới vào cuối section. Section
  Output chưa có tag nào → thêm tag mới.
- Tuỳ chọn **Overwrite**: xoá (các) tag `<img src="...">` hiện có trong
  section Output — chỉ xoá tag, giữ nguyên text khác user đã viết thêm trong section đó
  — rồi ghi tag mới vào.
- Save file → Trigger re-render → Button **không** ẩn (xem §3.2).

**Generate with AI** (§3.2) — mỗi field trong `TextResult` trả về map với đúng 1
section, append không hợp lý vì sẽ tạo ra 2 đoạn text lẫn lộn dưới cùng 1 heading:

- Section tồn tại và đang rỗng → điền vào.
- Section tồn tại và đã có nội dung → **bỏ qua**, không append, không ghi đè.
- Save file → Trigger re-render → Button **không** ẩn (xem §3.2).

## 3.5. Media File Naming Convention

- **Prefix:** `_obsidian_` by default, user-configurable in Settings → Media (§6.4 in
  `06-settings.md`), never empty (để Anki không xóa nhầm khi Check Media)
- **Format:** `{prefix}{word}_image_{timestamp}.{ext}` (audio was dropped — `image` is
  the only media type this ever names)
- **Ví dụ** (default prefix):
    - `_obsidian_apple_image_1698765433.png`

## 3.6. Auto-generate Content Structure

Khi user tạo note mới (qua command hoặc hotkey), plugin tự động sinh ra content structure dựa trên Model của profile đang chọn (`06-settings.md` §6.1):

**Ví dụ với Model "Basic (and reversed card)" (fields: Front, Back):**

```markdown
## Front

## Back
```

**Ví dụ với Model "Japanese Vocabulary" (fields: Word, Meaning, Furigana, Audio, Image):**

```markdown
## Word

## Meaning

## Furigana

## Audio

## Image
```

> **Đổi Model cho note có sẵn:** nút "Rebuild" ở Sidebar, tab Note
> (`07-sidebar.md` §7.2.1) xoá nội dung bên dưới frontmatter và sinh lại đúng skeleton này
> theo Model hiện tại của note — ngoại lệ: section của **Main Field**
> (`07-sidebar.md` §7.2.1) được điền sẵn `basename` hiện tại của note thay vì để trống.
> Rebuild yêu cầu Main Field đã được chọn cho cặp Deck+Model đó, xem §3.2.

> **Create new card / Create note from selection:** skeleton giống hệt trên, nhưng nếu
> Main Field đã được cấu hình cho cặp Deck+Model của profile đang dùng thì section của nó
> được điền sẵn — tên user vừa nhập (Create new card) hoặc text đã bôi đen (Create note
> from selection, §3.7). Không bắt buộc: nếu Main Field chưa cấu hình cho cặp đó (VD lần
> đầu dùng một Deck+Model mới, chưa có note nào mở để cấu hình), note vẫn được tạo bình
> thường, không field nào được điền — không giống Rebuild/Generate, 2 nút này không chặn.

## 3.7. Tạo Note Từ Text Được Chọn (Hotkey / Quick Capture)

Cách tạo note nhanh nhất: bôi đen 1 từ đang đọc, bấm hotkey, note mới xuất hiện ngay
trong folder của profile đang chọn — không cần mở Sidebar Modal, không cần nhập tên.

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
> plugin trước khi cam kết vào design doc chính.

**Flow:**

Deck/Model/Folder lấy từ **profile đang chọn** — cùng cơ chế với `07-sidebar.md` §7.3;
khác biệt duy nhất so với §7.3: filename lấy từ text đã bôi đen (không hỏi tên). Folder
đích là **Save notes to của profile** (`06-settings.md` §6.1), không phải folder của note
đang active.

1. User bôi đen text trong note markdown đang mở.
2. Bấm hotkey đã gán cho command `create-note-from-selection`.
3. Plugin tính filename = `sanitizeForFilename(selectedText)` + `.md` (tái dùng hàm từ
   `../contracts.md` §5 — vốn trước đây chỉ dùng cho tên file media, nay dùng chung cho
   tên note).
4. Plugin lấy Deck/Model/Folder từ profile đang chọn (không có ô nhập tên note — tên đã có
   từ text bôi đen):
    - **Profile có cả Deck và Model** → tạo note ngay, sang bước 5.
    - **Profile thiếu Deck hoặc Model** → hiện Notice "Please set up a profile in Settings
      first", tự mở Obsidian Settings tới tab của plugin, **không tạo note**, dừng lại
      (không có bước 5 trở đi).
5. Trùng tên file đã tồn tại trong Folder đích → tự thêm hậu tố số (hành vi mặc định của
   Obsidian khi tạo file trùng tên, VD "word 1.md") — không ghi đè, không báo lỗi, không
   mở file cũ thay vào.
6. Plugin tạo note với content skeleton **giống hệt §3.6** (một `## SectionName` cho mỗi
   field của Model, theo đúng thứ tự `modelFieldNames`) — **ngoại lệ duy nhất**: nếu Main
   Field (`07-sidebar.md` §7.2.1) đã được cấu hình cho cặp Deck+Model của profile này,
   section của nó được điền sẵn text đã chọn; các section còn lại để trống như §3.6 mô tả.
   Chưa cấu hình Main Field cho cặp đó → không field nào được điền (không chặn tạo note,
   xem §3.6).
    - Frontmatter: `anki_deck`, `anki_model` lấy từ Deck/Model của profile (bước 4).
7. Mở note mới trong editor (tại Folder của profile, bước 4).
8. Nếu Sidebar Modal chưa mở → tự mở ra (tab Note), để user xem/đổi Deck/Model của note vừa
   tạo nếu cần (giống `07-sidebar.md` §7.3 bước cuối).

Sau khi note được tạo, việc điền Meaning/Furigana/... không còn tự động — user tự bấm
nút Generate ở tab Text (§3.2) khi cần, có thể bấm lại nhiều lần.

---

> Đánh số Module nhảy **3 → 5** có chủ đích: Module 4 đã bị bỏ khỏi kế hoạch, không phải
> lỗi đánh số. Module tiếp theo là [`05-ui.md`](05-ui.md).
