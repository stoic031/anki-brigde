# 🔄 Luồng xử lý tổng thể (Updated)

> Xem [`README.md`](README.md) cho tổng quan kiến trúc. Chi tiết Sidebar Modal (3 tab):
> [`07-sidebar.md`](07-sidebar.md). Chi tiết nút note-controls: [`03-note.md`](03-note.md).

## Scenario 1: User tạo note qua icon "+" / command (lần đầu vs. đã cấu hình)

Sidebar Modal luôn có mặt ở Right Sidebar ngay sau khi cài plugin, gồm 3 tab cố định
(xem `07-sidebar.md` §7.2):

- **Tab 1 — Note:** Deck, Model, Folder lưu note, checkbox chọn field cho Generate with
  AI (checkbox chỉ hiện sau khi đã chọn Deck + Model).
- **Tab 2 — Audio:** Voice, Language, Overwrite/Append, nhiều dòng mapping field
  (Input → Output) — cho phép tạo nhiều field audio khác nhau trong 1 note.
- **Tab 3 — Image:** Overwrite/Append, 1 dòng mapping field (Input → Output) cố định —
  không cần nhiều dòng vì 1 note thường chỉ cần 1 ảnh.

Tab 2 và Tab 3 chỉ hiện sau khi Tab 1 đã có Deck + Model.

Bấm icon "+" trong Ribbon hoặc chạy command **"Anki: Create new note"** sẽ **tạo note
ngay** và đồng thời mở Sidebar Modal ra (nếu chưa mở) — không còn yêu cầu user tự mở
modal, chọn Deck/Model rồi mới bấm nút Create như trước.

**Resolve Deck/Model/Folder trước khi tạo note (xem `07-sidebar.md` §7.3/§7.4):**

```
[1] User bấm icon "+" (hoặc command "Anki: Create new note")
    ↓
[2] Resolve Deck/Model/Folder:
    ├─ Tab 1 đã có giá trị "hiện tại" → dùng luôn (trường hợp thường gặp, sang [3])
    ├─ Tab 1 chưa có, nhưng Settings Tab (`06-settings.md` §6.1) đã cấu hình default
    │  → seed Tab 1 bằng default này, sang [3] (giống hệt luồng dưới, không hỏi lại gì)
    └─ Cả Tab 1 lẫn Settings đều chưa cấu hình → Notice "Please configure Deck, Model,
       and Save location in Settings first", tự mở Settings tới tab của plugin,
       KHÔNG tạo note, dừng lại tại đây
    ↓
[3] Plugin hỏi tên note: "Enter note name:"
    ↓
[4] User nhập tên: "診察"
    ↓
[5] Plugin tạo note ngay bằng Deck/Model/Folder đã resolve ở bước [2]:
    ---
    anki_deck: "Japanese::N2"
    anki_model: "Basic (and reversed card)"
    ---

    (code block `anki-controls`)

    ## Front


    ## Back


    ↓
[6] Mở note mới trong editor
    ↓
[7] Sidebar Modal tự mở (Tab 1) nếu chưa mở, để user xem lại/đổi Deck/Model/Folder cho
    note vừa tạo — note chưa sync nên đổi ở đây chỉ ghi frontmatter, không cảnh báo
    (khác Scenario 4, áp dụng cho note đã sync)
    ↓
[8] User điền content:
    ## Front
    診察

    ## Back
    Khám bệnh

    ↓
[9] Bấm button "🔄 Sync" trong note
    ↓
[10] Plugin parse content → map "## Front" → Anki "Front", "## Back" → Anki "Back"
    ↓
[11] Gọi AnkiConnect "addNote"
    ↓
[12] Lưu anki_note_id vào frontmatter
    ↓
[13] Button đổi thành "✅ Synced" (2 giây)
    ↓
[14] Re-render controls (hiện thêm Delete button)
```

## Scenario 2: User tạo note từ text được chọn (Hotkey), dùng chung Sidebar Modal

Cũng dùng chung Sidebar Modal và cùng cơ chế 2-nhánh ở Scenario 1 — khác biệt duy nhất:
filename lấy từ text đã bôi đen (không hỏi tên). Folder đích **dùng Folder select đã lưu
ở Tab 1** (giống hệt Scenario 1), không phải folder của note đang active. Chi tiết đầy
đủ: `03-note.md` §3.7.

```
[1] User đang đọc 1 note markdown khác, bôi đen "薬"
    ↓
[2] Bấm hotkey đã gán cho command "create-note-from-selection"
    ↓
[3] Plugin tính filename = sanitizeForFilename("薬") = "薬.md"
    ↓
[4] Plugin resolve Deck/Model/Folder (cùng cơ chế `07-sidebar.md` §7.3):
    ├─ Tab 1 đã có giá trị "hiện tại" (VD: Deck "Japanese::N2", Model "Japanese
    │  Vocabulary", Folder "Vocabulary/") → dùng ngay
    ├─ Tab 1 chưa có, nhưng Settings Tab đã cấu hình default → seed Tab 1 bằng default
    │  này, dùng ngay (không hỏi lại gì, xem `03-note.md` §3.7)
    └─ Cả Tab 1 lẫn Settings đều chưa cấu hình → Notice nhắc cấu hình trong Settings, tự
       mở Settings tới tab của plugin, KHÔNG tạo note, dừng lại
    ↓
[5] Trùng tên đã tồn tại trong Folder đích → tự thêm hậu tố số ("薬 1.md")
    ↓
[6] Plugin tạo note trong Folder đã resolve ở bước 4:
    ---
    anki_deck: "Japanese::N2"
    anki_model: "Japanese Vocabulary"
    ---

    (code block `anki-controls`)

    ## Word
    薬

    ## Meaning


    ## Furigana


    ## Audio


    ## Image

    ↓
[7] Mở note mới trong editor
    ↓
[8] Sidebar Modal tự mở (Tab 1) nếu chưa mở
    ↓
[9] User bấm "🤖 Generate with AI" trong note-controls
    (không mở modal chọn field — nút generate ngay theo checkbox đã tick sẵn ở Tab 1
    cho cặp Deck+Model này, VD: Meaning, Furigana)
    ↓
[10] Plugin đọc "薬" từ section "## Word" → Gọi AI Provider
    processText("薬", "extract-vocabulary", ["Meaning", "Furigana"])
    → Nhận TextResult: { Meaning: "Thuốc", Furigana: "くすり" }
    → Điền vào "## Meaning" và "## Furigana" (đang rỗng)
    ↓
[11] (Tuỳ chọn) User bấm "🔊 Add Audio" / "🖼️ Add Image"
    (cũng generate ngay theo mapping đã cấu hình ở Tab 2/3 — xem Scenario 3/3b)
    ↓
[12] User review, chỉnh sửa nếu cần
    ↓
[13] Bấm "🔄 Sync" → Lưu vào Anki
```

> Nếu Tab 1 chưa tick field nào (Generate with AI) hoặc Tab 2/3 chưa cấu hình dòng
> mapping nào cho cặp Deck+Model này, bấm nút tương ứng chỉ hiện Notice nhắc cấu hình
> và không làm gì — xem `03-note.md` §3.2.

## Scenario 3: User thêm audio vào note (theo cấu hình Tab 2)

Khác với trước đây, không còn Field Selection Modal mở ra khi bấm — Tab 2 (Audio) của
Sidebar Modal đã cấu hình sẵn Voice, Language, Overwrite/Append và các dòng mapping
Input → Output cho cặp Deck+Model của note này (xem `07-sidebar.md` §7.2.2). Ví dụ cấu
hình Tab 2: Voice = Female, Language = Japanese, On existing tag = Append, 2 dòng:
`Word → Audio`, `Example → Example Audio`.

```
[1] User bấm "🔊 Add Audio"
    ↓
[2] Tab 2 chưa có dòng mapping nào cho Deck+Model này? → Notice "Please configure Audio
    field mapping for this Deck/Model in the sidebar (Tab 2) first." → dừng lại
    (trường hợp còn lại tiếp tục các bước dưới)
    ↓
[3] Với mỗi dòng đã cấu hình (VD dòng 1: Word → Audio):
    - Đọc nội dung section "## Word" làm input
    - Section rỗng → bỏ qua dòng này, không báo lỗi cả nút
    ↓
[4] Hiển thị progress: "🔊 Generating audio..."
    ↓
[5] Gọi AI Provider → generateAudio(wordContent, { voice: "Female", language: "Japanese" })
    ↓
[6] Nhận base64 → Gọi AnkiConnect "storeMediaFile"
    ↓
[7] Ghi vào section "## Audio" (field Output của dòng này) theo tuỳ chọn Append/Overwrite:
    - Append: giữ tag [sound:...] cũ (nếu có) + thêm tag mới
    - Overwrite: xoá tag [sound:...] cũ, ghi tag mới
    ↓
[8] Lặp lại bước 3-7 cho từng dòng còn lại (VD dòng 2: Example → Example Audio)
    ↓
[9] Save file → Re-render
    ↓
[10] Button "🔊 Add Audio" vẫn hiện — có thể bấm lại nhiều lần (không tự ẩn)
```

## Scenario 3b: User thêm image vào note (theo cấu hình Tab 3)

Giống Scenario 3 nhưng chỉ 1 dòng mapping cố định, không có Voice/Language (xem
`07-sidebar.md` §7.2.3). Ví dụ cấu hình Tab 3: On existing tag = Overwrite,
`Word → Image`.

```
[1] User bấm "🖼️ Add Image"
    ↓
[2] Tab 3 chưa chọn Input/Output cho Deck+Model này? → Notice "Please configure Image
    field mapping for this Deck/Model in the sidebar (Tab 3) first." → dừng lại
    ↓
[3] Đọc nội dung section "## Word" (field Input) làm prompt
    - Section rỗng → Notice "Nothing to generate an image from — please fill in the
      Word section first." → dừng lại
    ↓
[4] Hiển thị progress: "🎨 Generating image..."
    ↓
[5] Gọi AI Provider → generateImage(wordContent, opts) → Nhận base64
    ↓
[6] Gọi AnkiConnect "storeMediaFile"
    ↓
[7] Ghi vào section "## Image" (field Output) theo tuỳ chọn Overwrite: xoá tag
    <img src="..."> cũ, ghi tag mới
    ↓
[8] Save file → Re-render
    ↓
[9] Button "🖼️ Add Image" vẫn hiện — có thể bấm lại nhiều lần (không tự ẩn)
```

## Scenario 4: User thay đổi Deck/Model trong Sidebar Modal (Tab 1)

```
[1] User mở note đã sync (có anki_note_id trong frontmatter)
    ↓
[2] Mở Sidebar Modal → Tab 1 → Chọn Deck mới hoặc Model mới
    ↓
[3] Plugin hiển thị warning modal:
    "Note này đã sync với Deck/Model cũ.
     Bạn có muốn:
     - Giữ nguyên Deck/Model cũ
     - Cập nhật Deck/Model mới (sẽ tạo note mới trong Anki)"
    ↓
[4] User chọn:
    ├─ Giữ nguyên → Không thay đổi frontmatter
    └─ Cập nhật → Update anki_deck/anki_model trong frontmatter → Xóa anki_note_id (để tạo note mới khi sync)
```

> Cảnh báo này **chỉ** áp dụng cho note đã sync. Đổi Deck/Model cho note **chưa** sync
> (mới tạo, không có `anki_note_id`) — như ở bước [7] của Scenario 1 hoặc bước
> [8] của Scenario 2 — chỉ ghi đè frontmatter trực tiếp, không hiện warning modal này.
