# 📦 Module 1: Core Sync Engine

> Xem [`README.md`](README.md) cho tổng quan kiến trúc. Contracts (types, thuật toán chi
> tiết): `../contracts.md`.

## 1.1. Chức năng chính

- **Sync 1 chiều (Obsidian → Anki):** Tạo/cập nhật thẻ Anki từ note Obsidian
- **ID Mapping:** Quản lý `anki_note_id` trong frontmatter
- **Dynamic Field Mapping:** Tự động map content sang Anki fields dựa trên Model được chọn

> **Không có Conflict Resolution ở M1-2.** Sync là một chiều tuyệt đối: mỗi lần bấm
> "🔄 Sync", plugin ghi đè fields trên Anki bằng content hiện tại trong Obsidian. Plugin
> không bao giờ đọc field content ngược lại từ Anki, nên sửa trực tiếp trên Anki sẽ mất
> khi note được sync lại. Xem `docs/design-open-questions.md` lịch sử cho lý do.

## 1.2. Cấu trúc Note

**Frontmatter (chỉ chứa metadata sync):**

```yaml
---
anki_note_id: 1698765432109
anki_deck: 'Japanese::N2'
anki_model: 'Basic (and reversed card)'
last_synced: 2023-10-27T10:30:00Z # display-only, does not drive sync logic
tags: [vocabulary, medical]
---
```

**Content (chứa dữ liệu từ vựng):**

````markdown
```anki-controls
```

## Word

診察

## Meaning

Khám bệnh

## Furigana

しんさつ

## Part of Speech

Noun

## Collocations

- 診察を受ける
- 診察室

## Example

診察を受けました。

## Audio

[sound:_obsidian_診察_audio_1698765432.mp3]

## Image

<img src="_obsidian_診察_image_1698765433.png">
````

## 1.3. Data Flow

```
Obsidian Note (.md)
    ↓
[1] Đọc frontmatter (metadata) + content (data)
    ↓
[2] Parse content để extract các field:
    - Word: tìm heading "## Word" → lấy text bên dưới
    - Meaning: tìm heading "## Meaning" → lấy text bên dưới
    - Audio: tìm [sound:...] → lấy filename
    - Image: tìm <img src="..."> → lấy filename
    ↓
[3] Check anki_note_id trong frontmatter
    ├─ Không có → Gọi AnkiConnect "addNote" → Lưu ID vào frontmatter
    └─ Có → Gọi AnkiConnect "updateNoteFields" → Cập nhật fields
    ↓
[4] Hiển thị toast: "✅ Synced successfully"
```

## 1.4. AnkiConnect API Calls

**Tạo note mới:**

- Action: `addNote`
- Params: deckName, modelName, fields (dynamic), tags
- Response: noteId → lưu vào frontmatter

**Cập nhật note:**

- Action: `updateNoteFields`
- Params: noteId, fields
- Response: success/fail

**Xóa note:**

- Action: `deleteNotes`
- Params: notes array [noteId]
- Response: success/fail

**Lấy danh sách decks:**

- Action: `deckNames`
- Response: array of deck names

**Lấy danh sách models:**

- Action: `modelNames`
- Response: array of model names

**Lấy fields của model:**

- Action: `modelFieldNames`
- Params: modelName
- Response: array of field names (VD: ["Front", "Back", "Audio", "Image"])

## 1.5. Dynamic Field Mapping (Content → Anki)

Plugin tự động map content sang Anki fields dựa trên Model được chọn:

| Content Section | Anki Field                  | Cách extract                                        |
| --------------- | --------------------------- | --------------------------------------------------- |
| `## Word`       | Front (hoặc field đầu tiên) | Tìm heading "## Word" → lấy paragraph tiếp theo     |
| `## Meaning`    | Back (hoặc field thứ 2)     | Tìm heading "## Meaning" → lấy paragraph tiếp theo  |
| `## Furigana`   | Furigana (nếu có)           | Tìm heading "## Furigana" → lấy paragraph tiếp theo |
| `## Example`    | Example (nếu có)            | Tìm heading "## Example" → lấy paragraph tiếp theo  |
| `## Audio`      | Audio (nếu có)              | Tìm `[sound:filename.mp3]` → giữ nguyên full tag    |
| `## Image`      | Image (nếu có)              | Tìm `<img src="filename.png">` → giữ nguyên full tag |

> Field Audio/Image ghi **nguyên cả tag** (`[sound:file.mp3]`, `<img src="file.png">`) vào
> Anki, không phải chỉ tên file — Anki cần tag để phát audio/hiện ảnh. Xem `../contracts.md`
> §3.

**Thuật toán mapping (deterministic, chạy theo thứ tự, xem `../contracts.md` §3):**

1. **Pass 1 — exact name match:** với mỗi field của Model (theo thứ tự), nếu có section
   trùng tên (case-insensitive) → gán và đánh dấu đã dùng.
2. **Pass 2 — alias match:** với mỗi field còn trống, lấy section chưa dùng đầu tiên khớp
   alias của field đó (bảng alias trong `../contracts.md` §3, ví dụ "front" ↔ word/term/expression).
3. **Pass 3 — positional fallback:** **chỉ chạy nếu Pass 1 và 2 không map được gì cả** —
   gán N section đầu tiên (theo thứ tự trong document) vào N field đầu tiên của Model.
   Luôn kèm warning khi rơi vào case này.

Field không được map → để trống (empty string). Section không được map → **không bao giờ
bỏ qua âm thầm**: gộp lại và hiển thị **một** warning duy nhất, ví dụ:
`"3 sections not mapped to model 'X': Collocations, Part of Speech, Notes"`.

## 1.6. Error Handling

> Tất cả user-facing strings (toast, modal, button label) đều bằng **tiếng Anh**, vì plugin
> nhắm tới Obsidian community store. Tài liệu thiết kế này có thể ở tiếng Việt, nhưng chuỗi
> hiển thị cho user trong code luôn viết bằng tiếng Anh.

- **AnkiConnect offline:** Hiển thị modal "Anki is not running. Please start Anki and AnkiConnect."
- **Note not found in Anki:** Xóa `anki_note_id` trong frontmatter, tạo note mới
- **Duplicate note:** Hiển thị toast "Note already exists in Anki"
- **Parse error:** Hiển thị toast "Cannot parse note content. Please check format."
- **Model not found:** Hiển thị toast "Model not found in Anki. Please select it again."
