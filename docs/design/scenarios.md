# 🔄 Luồng xử lý tổng thể (Updated)

> Xem [`README.md`](README.md) cho tổng quan kiến trúc. Chi tiết Sidebar (Profile + tab):
> [`07-sidebar.md`](07-sidebar.md). Chi tiết các nút hành động (nằm ở Sidebar): [`03-note.md`](03-note.md).

## Scenario 1: User tạo note qua icon "+" / command (lần đầu vs. đã cấu hình)

Sidebar luôn có mặt ở Right Sidebar ngay sau khi cài plugin: dropdown **Profile** ở trên
cùng, rồi các tab (xem `07-sidebar.md` §7.2):

- **Tab Note:** Deck/Model của note đang mở và hàng nút **Sync | Rebuild | Delete**.
- **Tab Text:** chọn field cho Generate with AI + nút **Generate** (chỉ liệt kê field khi
  note đang mở có cả Deck + Model).
- **Tab Image** *(chưa triển khai)*: Overwrite/Append, chọn field Output. Prompt tạo ảnh do text model đã chọn viết từ các field của note.

Bấm icon "+" trong Ribbon hoặc chạy command **"Anki: Create new note"** sẽ **tạo note
ngay** và đồng thời mở Sidebar ra (nếu chưa mở) — không còn yêu cầu user tự mở
modal, chọn Deck/Model rồi mới bấm nút Create như trước. Deck/Model/Folder của note mới
lấy từ **profile đang chọn** (Settings Tab hoặc dropdown Profile ở Sidebar).

**Lấy Deck/Model/Folder từ profile trước khi tạo note (xem `07-sidebar.md` §7.3/§7.4):**

```
[1] User bấm icon "+" (hoặc command "Anki: Create new note")
    ↓
[2] Lấy profile đang chọn (`06-settings.md` §6.1):
    ├─ Có cả Deck và Model → sang [3]
    └─ Thiếu Deck hoặc Model → Notice "Please set up a profile in settings first", tự mở
       Settings tới tab của plugin, KHÔNG tạo note, dừng lại tại đây
    ↓
[3] Plugin hỏi tên note: "Enter note name:"
    ↓
[4] User nhập tên: "診察"
    ↓
[5] Plugin tạo note ngay bằng Deck/Model/Folder của profile:
    ---
    anki_deck: "Japanese::N2"
    anki_model: "Basic (and reversed card)"
    ---

    ## Front


    ## Back


    ↓
[6] Mở note mới trong editor
    ↓
[7] Sidebar tự mở (tab Note) nếu chưa mở; Deck/Model ở tab Note hiện đúng giá trị của
    note vừa tạo, user có thể đổi nhanh — note chưa sync nên đổi ở đây chỉ ghi frontmatter, không cảnh báo
    (khác Scenario 4, áp dụng cho note đã sync)
    ↓
[8] User điền content:
    ## Front
    診察

    ## Back
    Khám bệnh

    ↓
[9] Bấm nút "Sync" ở Sidebar (tab Note)
    ↓
[10] Plugin parse content → map "## Front" → Anki "Front", "## Back" → Anki "Back"
    ↓
[11] Gọi AnkiConnect "addNote"
    ↓
[12] Lưu anki_note_id vào frontmatter
    ↓
[13] Nút đổi thành "✅ Done!" (2 giây)
    ↓
[14] Sidebar nhận thay đổi frontmatter → hiện thêm nút Delete
```

## Scenario 2: User tạo note từ text được chọn (Hotkey), dùng chung Sidebar

Cũng dùng chung Sidebar và cùng cơ chế 2-nhánh ở Scenario 1 — khác biệt duy nhất:
filename lấy từ text đã bôi đen (không hỏi tên). Folder đích là **Save notes to của
profile đang chọn** (giống hệt Scenario 1), không phải folder của note đang active. Chi tiết đầy
đủ: `03-note.md` §3.7.

```
[1] User đang đọc 1 note markdown khác, bôi đen "薬"
    ↓
[2] Bấm hotkey đã gán cho command "create-note-from-selection"
    ↓
[3] Plugin tính filename = noteFilename("薬") = "薬.md"
    ↓
[4] Plugin lấy Deck/Model/Folder từ profile đang chọn (cùng cơ chế `07-sidebar.md` §7.3;
    VD: Deck "Japanese::N2", Model "Japanese Vocabulary", Folder "Vocabulary/"):
    ├─ Có cả Deck và Model → dùng ngay, không hỏi lại gì
    └─ Thiếu Deck hoặc Model → Notice nhắc thiết lập profile trong Settings, tự mở Settings
       tới tab của plugin, KHÔNG tạo note, dừng lại
    ↓
[5] Trùng tên đã tồn tại trong Folder đích → tự thêm hậu tố số ("薬 1.md")
    ↓
[6] Plugin tạo note trong Folder của profile (bước 4):
    ---
    anki_deck: "Japanese::N2"
    anki_model: "Japanese Vocabulary"
    ---

    ## Word
    薬

    ## Meaning


    ## Furigana


    ## Audio


    ## Image

    ↓
[7] Mở note mới trong editor
    ↓
[8] Sidebar tự mở (tab Note) nếu chưa mở
    ↓
[9] User chuyển sang tab Text, bấm "Generate"
    (không mở modal chọn field — nút generate ngay theo checkbox đã tick sẵn ở tab Text
    cho cặp Deck+Model này, VD: Meaning, Furigana; phần gọi AI hiện chưa triển khai)
    ↓
[10] Plugin đọc "薬" từ section "## Word" → Gọi AI Provider
    processText("薬", "extract-vocabulary", ["Meaning", "Furigana"])
    → Nhận TextResult: { Meaning: "Thuốc", Furigana: "くすり" }
    → Điền vào "## Meaning" và "## Furigana" (đang rỗng)
    ↓
[11] (Tuỳ chọn, chưa triển khai) User bấm "Add Image" ở tab Image
    (cũng generate ngay theo cấu hình ở đó — xem Scenario 3)
    ↓
[12] User review, chỉnh sửa nếu cần
    ↓
[13] Chuyển sang tab Note, bấm "Sync" → Lưu vào Anki
```

> Nếu tab Text chưa tick field nào (Generate) hoặc tab Image chưa chọn field Output cho cặp Deck+Model này, bấm nút tương ứng chỉ hiện Notice nhắc cấu hình
> và không làm gì — xem `03-note.md` §3.2.

## Scenario 3: User thêm image vào note (theo cấu hình tab Image) — chưa triển khai

Text model mà user đã chọn viết prompt từ các field của note, image model vẽ theo prompt đó
(xem `07-sidebar.md` §7.2.2). Ví dụ cấu hình tab Image: On existing tag = Overwrite,
Output = `Image`.

```
[1] User bấm "Add Image" (tab Image)
    ↓
[2] Tab Image chưa chọn Output cho Deck+Model này? → Notice "Please configure Image
    field mapping for this Deck/Model in the sidebar (Image tab) first." → dừng lại
    ↓
[3] Chưa cấu hình text provider? → Notice "Set up a text model in settings to generate
    image prompts." → dừng lại
    ↓
[4] Gom các section không rỗng (trừ Output) — VD Word, Meaning, Example. Không có section
    nào → Notice "Nothing to generate an image from — please fill in at least one field
    first." → dừng lại
    ↓
[5] Hiển thị progress: "🎨 Generating image..."
    ↓
[6] Text provider → processText(fields, "build-image-prompt", []) → prompt
    ↓
[7] Image provider → generateImage(prompt, opts) → Nhận base64
    ↓
[8] Gọi AnkiConnect "storeMediaFile"
    ↓
[9] Ghi vào section "## Image" (field Output) theo tuỳ chọn Overwrite: xoá tag
    <img src="..."> cũ, ghi tag mới
    ↓
[10] Save file → Re-render
    ↓
[11] Nút "Add Image" vẫn hiện — có thể bấm lại nhiều lần (không tự ẩn)
```

## Scenario 4: User thay đổi Deck/Model của note trong Sidebar (tab Note)

```
[1] User mở note đã sync (có anki_note_id trong frontmatter)
    ↓
[2] Mở Sidebar → tab Note (Deck/Model đang hiện đúng giá trị trong frontmatter của
    note) → Chọn Deck mới hoặc Model mới
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
