# 🔄 Luồng xử lý tổng thể (Updated)

> Xem [`README.md`](README.md) cho tổng quan kiến trúc.

## Scenario 1: User tạo note từ Sidebar Modal

```
[1] User mở Sidebar Modal (click icon trong Ribbon)
    ↓
[2] Chọn Deck: "Japanese::N2"
    ↓
[3] Chọn Model: "Basic (and reversed card)"
    ↓
[4] Plugin tự động lấy fields: ["Front", "Back"]
    ↓
[5] User bấm "📝 Create New Note"
    ↓
[6] Nhập tên note: "診察"
    ↓
[7] Plugin tạo note:
    ---
    anki_deck: "Japanese::N2"
    anki_model: "Basic (and reversed card)"
    ---

    (code block `anki-controls`)

    ## Front


    ## Back


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

## Scenario 2: User tạo note từ text được chọn (Hotkey) rồi Generate with AI

```
[1] User đang đọc 1 note markdown khác, bôi đen "薬"
    ↓
[2] Bấm hotkey đã gán cho command "create-note-from-selection"
    ↓
[3] Plugin đọc Deck/Model đã lưu gần nhất trong settings:
    Deck: "Japanese::N2", Model: "Japanese Vocabulary"
    (chưa từng chọn Deck/Model → Notice lỗi, dừng lại — xem 03-note.md §3.7)
    ↓
[4] Plugin tính filename = sanitizeForFilename("薬") = "薬.md"
    Trùng tên đã tồn tại trong folder → tự thêm hậu tố số ("薬 1.md")
    ↓
[5] Plugin tạo note trong CÙNG folder với note đang đọc:
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
[6] Mở note mới trong editor
    ↓
[7] User bấm "🤖 Generate with AI" trong note-controls → mở Field Selection Modal
    (checkbox: Meaning, Furigana, Audio, Image)
    ↓
[8] User tick Meaning + Furigana → bấm "Generate"
    ↓
[9] Plugin đọc "薬" từ section "## Word" → Gọi AI Provider
    processText("薬", "extract-vocabulary", ["Meaning", "Furigana"])
    → Nhận TextResult: { Meaning: "Thuốc", Furigana: "くすり" }
    → Điền vào "## Meaning" và "## Furigana" (đang rỗng)
    ↓
[10] (Tuỳ chọn) User bấm "🔊 Add Audio" / "🖼️ Add Image"
    ↓
[11] User review, chỉnh sửa nếu cần
    ↓
[12] Bấm "🔄 Sync" → Lưu vào Anki
```

## Scenario 3: User thêm audio vào note

```
[1] User bấm "🔊 Add Audio"
    ↓
[2] Plugin parse content → extract word + example_sentence
    ↓
[3] Hiển thị progress: "🔊 Generating audio..."
    ↓
[4] Gọi AI Provider → generateAudio(word + example)
    ↓
[5] Nhận base64 → Gọi AnkiConnect "storeMediaFile"
    ↓
[6] Chèn [sound:_obsidian_{word}_audio_{timestamp}.mp3] vào section "## Audio"
    ↓
[7] Save file → Re-render
    ↓
[8] Button ẩn đi (vì đã có audio)
```

## Scenario 4: User thay đổi Deck/Model trong Sidebar Modal

```
[1] User mở note đã sync (có anki_note_id trong frontmatter)
    ↓
[2] Mở Sidebar Modal → Chọn Deck mới hoặc Model mới
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
